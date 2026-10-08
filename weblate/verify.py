"""Exercise the REST edit path and report differences, restoring the fixture."""
import json
from pathlib import Path
from rest_framework.test import APIClient
from weblate.auth.models import User
from weblate.trans.models import Component
from weblate.utils.state import STATE_TRANSLATED

component = Component.objects.get(project__slug="plural-playground", slug="i18next-v4")
translation = component.translation_set.get(language__code="lt")
client = APIClient()
client.force_authenticate(User.objects.get(username="admin"))
path = Path(component.repository.path) / "src/locales/lt/translation.json"
component.commit_pending("before local verification", None, skip_push=True)
before = json.loads(path.read_text())
units = []
for key in ("apples", "messages", "files"):
    unit = translation.unit_set.get(context=key)
    units.append((unit, unit.get_target_plurals(), unit.state))

report = {"editor_form_counts": {unit.context: len(forms) for unit, forms, _ in units}, "before": before}
try:
    for unit, original, state in units:
        response = client.patch(f"/api/units/{unit.pk}/",
                                {"target": [text + " [round-trip]" for text in original],
                                 "state": STATE_TRANSLATED}, format="json", HTTP_HOST="localhost")
        assert response.status_code == 200, (response.status_code, response.data)
    component.commit_pending("local verification edit", None, skip_push=True)
    exported = json.loads(path.read_text())
    report["after"] = exported
    report["removed_keys"] = sorted(set(before) - set(exported))
    report["added_keys"] = sorted(set(exported) - set(before))
    report["visible_forms_saved_correctly"] = all(
        exported.get(f"{key}_{suffix}") == before.get(f"{key}_{suffix}", "") + " [round-trip]"
        for key in ("apples", "messages", "files") for suffix in ("one", "few", "other")
    )
    report["fractional_forms_preserved"] = all(
        f"{key}_many" in before and exported.get(f"{key}_many") == before[f"{key}_many"]
        for key in ("apples", "messages", "files")
    )
    report["passed"] = (report["visible_forms_saved_correctly"] and report["fractional_forms_preserved"]
                         and not report["removed_keys"] and not report["added_keys"])
finally:
    for unit, original, state in units:
        response = client.patch(f"/api/units/{unit.pk}/", {"target": original, "state": state},
                                format="json", HTTP_HOST="localhost")
        assert response.status_code == 200, (response.status_code, response.data)
    component.commit_pending("restore local verification text", None, skip_push=True)
    # The writer may drop uneditable _many keys even during restoration. Restore
    # the complete pre-test file and rescan it, preserving existing user edits.
    if json.loads(path.read_text()) != before:
        with component.repository.lock:
            path.write_text(json.dumps(before, ensure_ascii=False, indent=2) + "\n")
            component.repository.execute(["add", "src/locales/lt/translation.json"], remote_op="none")
            component.repository.execute(["-c", "user.name=Local verification", "-c", "user.email=local@example.test",
                                          "commit", "-m", "Restore complete plural verification fixture"], remote_op="none")
        component.create_translations(force=True, force_scan=True)
    assert json.loads(path.read_text()) == before, "Original file content was not restored"
    report["original_content_restored"] = True
print(json.dumps(report, ensure_ascii=False))
