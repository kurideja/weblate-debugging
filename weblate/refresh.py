from django.test.utils import override_settings
from weblate.trans.models import Component

component = Component.objects.get(project__slug="plural-playground", slug="i18next-v4")
with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
    if not component.do_update():
        raise RuntimeError("Repository update failed; inspect Weblate component alerts")
    component.create_translations(force=True, force_scan=True)
print("Imported and parsed the local Git fixture in Weblate.")
