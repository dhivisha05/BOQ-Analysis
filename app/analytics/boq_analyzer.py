from typing import Dict, List
from loguru import logger


def analyze_boq(items: List[Dict]) -> Dict:
    """Analyze extracted BOQ items for category summaries and insights.

    Returns:
        {
            "category_summary": {category: {count, total_quantity, items_preview}},
            "top_5_by_quantity": [...],
            "uncategorized": {count, descriptions},
            "total_items": int,
            "categories_found": int
        }
    """
    if not items:
        return {
            "category_summary": {},
            "top_5_by_quantity": [],
            "uncategorized": {"count": 0, "descriptions": []},
            "total_items": 0,
            "categories_found": 0,
        }

    # Category summary
    category_summary = {}
    for item in items:
        cat = item.get("category", "Uncategorized")
        if cat not in category_summary:
            category_summary[cat] = {
                "count": 0,
                "total_quantity": 0.0,
                "items_preview": [],
            }

        category_summary[cat]["count"] += 1
        category_summary[cat]["total_quantity"] += float(item.get("quantity", 0))

        if len(category_summary[cat]["items_preview"]) < 3:
            category_summary[cat]["items_preview"].append(
                item.get("description", "")[:80]
            )

    # Top 5 by quantity
    sorted_items = sorted(items, key=lambda x: float(x.get("quantity", 0)), reverse=True)
    top_5 = []
    for item in sorted_items[:5]:
        top_5.append({
            "description": item.get("description", ""),
            "quantity": float(item.get("quantity", 0)),
            "unit": item.get("unit", "-"),
            "category": item.get("category", "Uncategorized"),
        })

    # Uncategorized items
    uncat_items = [i for i in items if i.get("category") == "Uncategorized"]
    uncategorized = {
        "count": len(uncat_items),
        "descriptions": [i.get("description", "")[:100] for i in uncat_items[:10]],
    }

    result = {
        "category_summary": category_summary,
        "top_5_by_quantity": top_5,
        "uncategorized": uncategorized,
        "total_items": len(items),
        "categories_found": len([k for k in category_summary if k != "Uncategorized"]),
    }

    logger.info(
        f"Analysis: {result['total_items']} items, "
        f"{result['categories_found']} categories"
    )
    return result
