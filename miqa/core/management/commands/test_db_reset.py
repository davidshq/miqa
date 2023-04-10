import djclick as click
from miqa.core.models import ScanDecision



@click.command()
def command():
    print("Deleting Scan Decisions")
    ScanDecision.objects.filter().delete()
