import json, sys
with open(r"d:\Minor's\csp\server\python\models\class_labels.json") as f:
    d = json.load(f)
print("type:", type(d).__name__)
if isinstance(d, dict):
    items = list(d.items())
    print("first 3 items:", items[:3])
    print("total keys:", len(items))
elif isinstance(d, list):
    print("first 3:", d[:3])
    print("total:", len(d))
