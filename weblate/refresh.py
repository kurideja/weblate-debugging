from weblate.trans.models import Component

component = Component.objects.get(project__slug="plural-playground", slug="i18next-v4")
if not component.do_update():
    raise RuntimeError("Repository update failed; inspect Weblate component alerts")
print("Updated Weblate from the local Git fixture. Check component alerts for merge conflicts.")
