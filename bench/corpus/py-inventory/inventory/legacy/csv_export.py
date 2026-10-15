# Nothing imports this module any more.
from inventory.models import Item


def export(items):
    return "\n".join(i.name for i in items)
