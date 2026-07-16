import unittest

from app.core_algorithm import allocate_courses, _eliminate_local_inefficiencies


class AllocateCoursesTieBreakerTests(unittest.TestCase):
    def test_historical_lambda_breaks_tie_on_equal_course_dissatisfaction(self):
        courses = ["C1", "C2"]
        faculty = ["alice@example.com", "bob@example.com"]
        pref_matrix = {
            "alice@example.com": {"C1": 5, "C2": 3},
            "bob@example.com": {"C2": 3},
        }
        counts = {"C1": 1, "C2": 1}
        caps = {"alice@example.com": 2, "bob@example.com": 2}
        prev_pd = {"alice@example.com": 0, "bob@example.com": 10}
        prev_taught = {"alice@example.com": 1, "bob@example.com": 1}

        assignments, total_dissatisfaction = allocate_courses(
            courses=courses,
            faculty=faculty,
            pref_matrix=pref_matrix,
            counts=counts,
            caps=caps,
            prev_pd=prev_pd,
            prev_taught=prev_taught,
        )

        self.assertEqual(assignments["C1"], ["alice@example.com"])
        self.assertEqual(assignments["C2"], ["bob@example.com"])
        self.assertEqual(total_dissatisfaction, {
            "alice@example.com": 4,
            "bob@example.com": 2,
        })

    def test_post_allocation_reassignment_reduces_fairness_gap_without_increasing_total(self):
        courses = ["C1", "C2"]
        faculty = ["alice@example.com", "bob@example.com"]
        pref_matrix = {
            "alice@example.com": {"C1": 5, "C2": 5},
            "bob@example.com": {"C1": 5, "C2": 5},
        }
        counts = {course: 1 for course in courses}
        caps = {"alice@example.com": 2, "bob@example.com": 2}

        assignments, total_dissatisfaction = allocate_courses(
            courses=courses,
            faculty=faculty,
            pref_matrix=pref_matrix,
            counts=counts,
            caps=caps,
        )

        self.assertEqual(sum(total_dissatisfaction.values()), 8)
        self.assertEqual(
            max(total_dissatisfaction.values()) - min(total_dissatisfaction.values()),
            0,
        )
        self.assertEqual(total_dissatisfaction, {
            "alice@example.com": 4,
            "bob@example.com": 4,
        })
        self.assertEqual(assignments["C1"], ["bob@example.com"])
        self.assertEqual(assignments["C2"], ["alice@example.com"])

    def test_post_allocation_swap_runs_when_reassignment_cannot_improve(self):
        courses = ["C1", "C2", "C3", "C4"]
        faculty = ["alice@example.com", "bob@example.com"]
        pref_matrix = {
            "alice@example.com": {"C1": 2, "C2": 2, "C3": 5, "C4": 5},
            "bob@example.com": {"C1": 1, "C2": 1, "C3": 4, "C4": 4},
        }
        counts = {course: 1 for course in courses}
        caps = {"alice@example.com": 2, "bob@example.com": 2}

        assignments, total_dissatisfaction = allocate_courses(
            courses=courses,
            faculty=faculty,
            pref_matrix=pref_matrix,
            counts=counts,
            caps=caps,
        )

        self.assertEqual(sum(total_dissatisfaction.values()), 8)
        self.assertEqual(
            max(total_dissatisfaction.values()) - min(total_dissatisfaction.values()),
            2,
        )
        self.assertEqual(total_dissatisfaction, {
            "alice@example.com": 5,
            "bob@example.com": 3,
        })
        self.assertEqual(assignments["C1"], ["alice@example.com"])
        self.assertEqual(len(assignments["C3"]), 1)

    def test_local_inefficiency_reassignment_can_reduce_total_without_reducing_gap(self):
        faculty = ["alice@example.com", "bob@example.com", "carol@example.com"]
        assignments = {
            "C1": ["alice@example.com"],
            "C2": ["carol@example.com"],
        }
        pref_matrix = {
            "alice@example.com": {"C1": 5},
            "bob@example.com": {"C1": 3},
            "carol@example.com": {"C2": 5},
        }
        counts = {"C1": 1, "C2": 1}
        caps = {
            "alice@example.com": 1,
            "bob@example.com": 1,
            "carol@example.com": 1,
        }
        totals = {
            "alice@example.com": 4,
            "bob@example.com": 0,
            "carol@example.com": 4,
        }

        assignments, total_dissatisfaction = _eliminate_local_inefficiencies(
            assignments, faculty, pref_matrix, counts, caps, totals
        )

        self.assertEqual(assignments["C1"], ["bob@example.com"])
        self.assertEqual(sum(total_dissatisfaction.values()), 6)
        self.assertEqual(
            max(total_dissatisfaction.values()) - min(total_dissatisfaction.values()),
            4,
        )

    def test_local_inefficiency_swap_runs_when_reassignment_has_no_capacity(self):
        faculty = ["alice@example.com", "bob@example.com", "carol@example.com"]
        assignments = {
            "C1": ["alice@example.com"],
            "C2": ["bob@example.com"],
        }
        pref_matrix = {
            "alice@example.com": {"C1": 5, "C2": 2},
            "bob@example.com": {"C1": 3, "C2": 5},
        }
        counts = {"C1": 1, "C2": 1}
        caps = {
            "alice@example.com": 1,
            "bob@example.com": 1,
            "carol@example.com": 0,
        }
        totals = {
            "alice@example.com": 4,
            "bob@example.com": 4,
            "carol@example.com": 0,
        }

        assignments, total_dissatisfaction = _eliminate_local_inefficiencies(
            assignments, faculty, pref_matrix, counts, caps, totals
        )

        self.assertEqual(assignments["C1"], ["bob@example.com"])
        self.assertEqual(assignments["C2"], ["alice@example.com"])
        self.assertEqual(sum(total_dissatisfaction.values()), 3)
        self.assertLessEqual(
            max(total_dissatisfaction.values()) - min(total_dissatisfaction.values()),
            4,
        )

    def test_local_swap_rejects_equal_total_tradeoff_without_overall_preference_gain(self):
        faculty = ["alice@example.com", "bob@example.com"]
        assignments = {
            "C1": ["alice@example.com"],
            "C2": ["bob@example.com"],
        }
        pref_matrix = {
            "alice@example.com": {"C1": 5, "C2": 4},
            "bob@example.com": {"C1": 3, "C2": 2},
        }
        counts = {"C1": 1, "C2": 1}
        caps = {
            "alice@example.com": 1,
            "bob@example.com": 1,
        }
        totals = {
            "alice@example.com": 4,
            "bob@example.com": 1,
        }

        assignments, total_dissatisfaction = _eliminate_local_inefficiencies(
            assignments, faculty, pref_matrix, counts, caps, totals
        )

        self.assertEqual(assignments["C1"], ["alice@example.com"])
        self.assertEqual(assignments["C2"], ["bob@example.com"])
        self.assertEqual(total_dissatisfaction, totals)


if __name__ == "__main__":
    unittest.main()
