from weblate.trans.models import Component

component = Component.objects.get(project__slug="plural-playground", slug="i18next-v4")
if not component.do_push(None):
    raise RuntimeError("Local push failed; check the component repository alerts")
print("Pushed Weblate commits to the local Git fixture repository.")
