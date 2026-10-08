"""Exercise Weblate's REST editor and JSON writer, then restore the input file."""
import json
from pathlib import Path

from django.test.utils import override_settings
from rest_framework.test import APIClient
from weblate.auth.models import User
from weblate.trans.models import Component
from weblate.utils.state import STATE_TRANSLATED


def verify():
    component = Component.objects.get(project__slug="plural-playground", slug="i18next-v4")
    translation = component.translation_set.get(language__code="lt")
    client = APIClient()
    client.force_authenticate(User.objects.get(username="admin"))
    path = Path(component.repository.path) / "src/locales/lt/translation.json"
    component.commit_pending("before local verification", None, skip_push=True)
    before_text = path.read_text()
    before = json.loads(before_text)
    keys = ("apples", "messages", "files")
    report = {"passed": False, "before": before, "errors": [], "original_content_restored": True}
    missing = [f"{key}_{suffix}" for key in keys for suffix in ("one", "few", "many", "other")
               if f"{key}_{suffix}" not in before]
    if missing:
        report["errors"].append(f"Input is already missing {', '.join(missing)}. Extract, fill, and import the forms before verifying.")
        return report

    units = []
    for key in keys:
        unit = translation.unit_set.get(context=key)
        original = unit.get_target_plurals()
        # Support the current three editor forms and a future four-form fix.
        if len(original) not in (3, 4):
            report["errors"].append(f"Unexpected editor form count for {key}: {len(original)}")
            return report
        units.append((unit, original, unit.state))
    report["editor_form_counts"] = {unit.context: len(forms) for unit, forms, _ in units}
    edited = []

    def patch(unit, target, state):
        response = client.patch(f"/api/units/{unit.pk}/", {"target": target, "state": state},
                                format="json", HTTP_HOST="localhost")
        if response.status_code != 200:
            raise RuntimeError(f"REST edit for {unit.context}: HTTP {response.status_code}, {response.data}")

    try:
        for unit, original, state in units:
            # Include this unit in restoration even if the request fails midway.
            edited.append((unit, original, state))
            patch(unit, [text + " [round-trip]" for text in original], STATE_TRANSLATED)
        component.commit_pending("local verification edit", None, skip_push=True)
        exported = json.loads(path.read_text())
        report["after"] = exported
        report["removed_keys"] = sorted(set(before) - set(exported))
        report["added_keys"] = sorted(set(exported) - set(before))
        expected = {}
        for unit, original, _ in units:
            suffixes = ("one", "few", "other") if len(original) == 3 else ("one", "few", "many", "other")
            expected.update({f"{unit.context}_{suffix}": before[f"{unit.context}_{suffix}"] + " [round-trip]"
                             for suffix in suffixes})
        report["visible_forms_saved_correctly"] = all(exported.get(key) == value for key, value in expected.items())
        report["fractional_forms_preserved"] = all(
            exported.get(f"{key}_many") == expected.get(f"{key}_many", before[f"{key}_many"])
            for key in keys
        )
        report["unchanged_keys_preserved"] = all(exported.get(key) == value for key, value in before.items() if key not in expected)
        report["passed"] = (report["visible_forms_saved_correctly"] and report["fractional_forms_preserved"]
                             and report["unchanged_keys_preserved"] and not report["removed_keys"] and not report["added_keys"])
    except Exception as error:
        report["errors"].append(str(error))
    finally:
        for unit, original, state in edited:
            try:
                patch(unit, original, state)
            except Exception as error:
                report["errors"].append(f"REST restoration: {error}")
        try:
            component.commit_pending("restore local verification text", None, skip_push=True)
            # The writer can drop _many during restoration too. Restore the
            # complete original bytes in Git and parse the restored file inline.
            if path.read_text() != before_text:
                with component.repository.lock:
                    path.write_text(before_text)
                    component.repository.execute(["add", "src/locales/lt/translation.json"], remote_op="none")
                    component.repository.execute(["-c", "user.name=Local verification", "-c", "user.email=local@example.test",
                                                  "commit", "-m", "Restore complete plural verification fixture"], remote_op="none")
                with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
                    component.create_translations(force=True, force_scan=True)
            report["original_content_restored"] = path.read_text() == before_text
        except Exception as error:
            report["original_content_restored"] = False
            report["errors"].append(f"File restoration: {error}")
        if report["errors"] or not report["original_content_restored"]:
            report["passed"] = False
    return report


print(json.dumps(verify(), ensure_ascii=False))
