import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
import main


class NutritionTests(unittest.TestCase):
    def profile(self, **changes):
        return main.FitnessProfile(**dict(age=30, height_cm=180, weight_kg=80,
            sex_coefficient="male", activity="moderate", goal="balanced", **changes))

    def test_formula_and_allocations(self):
        result = main.calculate_targets(main.TargetRequest(profile=self.profile()))
        self.assertEqual(result["daily"]["calories"], 2759)
        self.assertAlmostEqual(result["daily"]["protein_g"], 137.95, delta=0.1)
        self.assertEqual(set(result["meals"]), {"breakfast", "lunch", "dinner", "snack"})
        self.assertAlmostEqual(sum(m["calories"] for m in result["meals"].values()), 2759, delta=.2)
        result = main.calculate_targets(main.TargetRequest(profile=self.profile(), include_snack=False))
        self.assertNotIn("snack", result["meals"])
        self.assertAlmostEqual(result["meals"]["breakfast"]["calories"], 827.7)

    def test_coefficients_and_goals(self):
        for sex, offset in [("male", 5), ("female", -161)]:
            for activity, factor in [("sedentary",1.2),("light",1.375),("moderate",1.55),("high",1.725)]:
                p = self.profile()
                p.sex_coefficient, p.activity = sex, activity
                result = main.calculate_targets(main.TargetRequest(profile=p))
                self.assertEqual(result["daily"]["calories"], round((800+1125-150+offset)*factor))
        p = self.profile()
        p.goal = "strength"
        n = main.calculate_targets(main.TargetRequest(profile=p))["daily"]
        self.assertAlmostEqual(n["protein_g"] * 4/n["calories"], .30, places=3)

    def test_manual_and_eligibility(self):
        for changes in [{"age":17},{"pregnant_or_breastfeeding":True}]:
            p = self.profile()
            for key,value in changes.items(): setattr(p,key,value)
            with self.assertRaises(HTTPException): main.calculate_targets(main.TargetRequest(profile=p))
            p.override = main.Nutrition(calories=2000, protein_g=100, carbs_g=250, fat_g=66.7)
            result = main.calculate_targets(main.TargetRequest(profile=p))
            self.assertEqual(result["source"], "manual")
            self.assertEqual(result["daily"]["calories"], 2000)

    def test_invalid_nutrition(self):
        for changes in [{"calories":float("nan")},{"protein_g":float("inf")},{"fat_g":-1},{"calories":1000}]:
            values = dict(calories=400, protein_g=25, carbs_g=50, fat_g=11.1)
            values.update(changes)
            with self.assertRaises(ValidationError): main.Nutrition(**values)
        with self.assertRaises(ValidationError): self.profile(macro_percentages=[50,30,30])
        with self.assertRaises(ValidationError): self.profile(macro_percentages=[float("nan"),20,30])


class SuggestionTests(unittest.TestCase):
    def request(self, **changes):
        return main.SuggestionsRequest(constraints=main.Constraints(household_size=3), slots=[main.MealSlotRequest(id="dinner",label="Dinner",local_date="2026-10-12")], **changes)

    def output(self):
        return {"slots":[{"slot_id":"dinner", "options":[dict(id=str(i),title=f"Meal {i}",description="A meal",cook_time_minutes=30,cuisine="Test",tags=[],ingredients=[{"name":"Rice","quantity":"3 cups for 3 people"}],nutrition=dict(calories=400,protein_g=25,carbs_g=50,fat_g=11.1),workout_rationale="Supports your goal.") for i in range(3)]}]}

    def call(self, output, req=None):
        client = SimpleNamespace(messages=SimpleNamespace(create=lambda **kwargs: SimpleNamespace(content=[SimpleNamespace(type="tool_use",input=output)])))
        with patch.dict(main.os.environ, {"ANTHROPIC_API_KEY":"test-only"}), patch.object(main.anthropic,"Anthropic",return_value=client):
            return main.suggestions(req or self.request())

    def test_legacy_dinner(self):
        req = main.SuggestionsRequest(constraints=main.Constraints(),slots=[{"id":"tonight","label":"Tonight"}])
        output = self.output(); output["slots"][0]["slot_id"]="tonight"
        self.assertEqual(len(self.call(output,req).slots[0].options),3)

    def test_invalid_ai_responses(self):
        for mutate in [lambda x:x["slots"][0].update(slot_id="other"), lambda x:x["slots"][0]["options"].pop(), lambda x:x["slots"][0]["options"][0].update(nutrition=None), lambda x:x["slots"][0]["options"][0]["nutrition"].update(calories=2000),lambda x:x["slots"][0]["options"][0].update(cook_time_minutes=100)]:
            output=self.output(); mutate(output)
            with self.assertRaises(HTTPException) as context: self.call(output)
            self.assertEqual(context.exception.status_code,502)

    def test_consent_and_workout_privacy(self):
        workout = dict(id="private-id",source="manual",start_time="2026-10-12T12:00:00Z",local_date="2026-10-12",type="Running",duration_minutes=30,status="completed",active_calories=300)
        with self.assertRaises(ValidationError): self.request(workouts=[workout])
        req = self.request(workouts=[workout],workout_consent=True)
        prompt=main.build_prompt(req)
        self.assertIn('"status": "completed"',prompt)
        self.assertNotIn("private-id",prompt)
        self.assertNotIn("active_calories",prompt)
        self.assertIn("Household size: 3",prompt)
        workout["local_date"]="2026-10-13"; workout["type"]="Swimming"
        self.assertNotIn("Swimming",main.build_prompt(self.request(workouts=[workout],workout_consent=True)))

    def test_missing_key(self):
        with patch.dict(main.os.environ,{},clear=True):
            with self.assertRaises(HTTPException) as context: main.suggestions(self.request())
        self.assertEqual(context.exception.status_code,503)




class HttpRouteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        main.app.dependency_overrides[main.signed_owner] = lambda: "test-user"

    async def asyncTearDown(self):
        main.app.dependency_overrides.clear()

    async def test_targets_and_validation_over_http(self):
        import httpx
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
            profile = dict(age=30,height_cm=180,weight_kg=80,sex_coefficient="male",activity="moderate",goal="balanced")
            response = await client.post("/nutrition/targets",json={"profile":profile,"include_snack":False})
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()["daily"]["calories"],2759)
            self.assertNotIn("snack",response.json()["meals"])
            profile["age"] = 17
            self.assertEqual((await client.post("/nutrition/targets",json={"profile":profile})).status_code,422)
            profile["override"] = dict(calories=2000,protein_g=100,carbs_g=250,fat_g=66.7)
            self.assertEqual((await client.post("/nutrition/targets",json={"profile":profile})).json()["source"],"manual")


if __name__ == "__main__": unittest.main()
