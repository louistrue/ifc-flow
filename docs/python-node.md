# Python Script Node

The Python Script node lets you run custom Python code as part of a workflow. It receives the incoming data as `input_data` and must assign the variable `result` which will be passed to the next node.

Example workflow script:

```python
from collections import defaultdict
import hashlib

elements = input_data.get("elements", [])

def get_storey_name(el):
    for rel in el.get("ContainedInStructure", []):
        relating = rel.get("RelatingStructure", {})
        if relating.get("type") == "IfcBuildingStorey":
            return relating.get("Name") or relating.get("GlobalId")
    return "—"

def checksum(guid):
    if not guid:
        return "n/a"
    return hashlib.md5(guid.encode()).hexdigest()[:6]

def is_load_bearing(eltype):
    return eltype in ["IfcWall", "IfcColumn", "IfcBeam"]

agg = defaultdict(lambda: {"Count": 0, "Heights": [], "Widths": []})

for el in elements:
    if not isinstance(el, dict):
        continue
    eltype = el.get("type", "???")
    pred = el.get("PredefinedType") or el.get("ObjectType") or "—"
    storey = get_storey_name(el)
    key = f"{eltype} | {pred} | {storey}"

    agg[key]["Count"] += 1
    if "OverallHeight" in el:
        agg[key]["Heights"].append(el["OverallHeight"])
    if "OverallWidth" in el:
        agg[key]["Widths"].append(el["OverallWidth"])
    agg[key]["LastGUID"] = checksum(el.get("GlobalId"))

# Convert to Watch-friendly format
result = []
for k, v in sorted(agg.items()):
    eltype, pred, storey = k.split(" | ")
    avg_h = round(sum(v["Heights"]) / len(v["Heights"])) if v["Heights"] else None
    avg_w = round(sum(v["Widths"]) / len(v["Widths"])) if v["Widths"] else None
    result.append({
        "Type": eltype,
        "Predefined": pred,
        "Storey": storey,
        "Count": v["Count"],
        "AvgHeight": avg_h,
        "AvgWidth": avg_w,
        "Checksum": v["LastGUID"],
        "LoadBearing?": "✓" if is_load_bearing(eltype) else ""
    })
```
