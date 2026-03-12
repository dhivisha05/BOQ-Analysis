from typing import Dict, List
from loguru import logger

# ─── Thresholds ───────────────────────────────────────────────
HIGH_UNCATEGORIZED = 0.15   # >15% uncategorized = problem
DOMINANT_CATEGORY = 0.60    # one category >60% = imbalance
ZERO_QTY = 0.30             # >30% have qty=0 = missing data


def detect_risks(items: List[Dict]) -> Dict:
    """Detect procurement and data-quality risks in BOQ items.

    Risk flags:
      - extraction_quality: too many uncategorized items
      - category_imbalance: one category dominates
      - price_volatility: volatile categories with >5 items
      - missing_quantities: too many zero-quantity items

    Score: High=30pts, Medium=15pts, Low=5pts per flag (max 100)
    Level: score>=60 → High, >=30 → Medium, else → Low
    """
    if not items:
        return {
            "risk_score": 0,
            "risk_level": "Low",
            "category_distribution": {},
            "flags": [],
            "total_items_analyzed": 0,
        }

    total = len(items)
    flags = []

    # ── Category distribution ─────────────────────────────────
    category_counts = {}
    for item in items:
        cat = item.get("category", "Uncategorized")
        category_counts[cat] = category_counts.get(cat, 0) + 1

    category_distribution = {
        cat: round(count / total, 3) for cat, count in category_counts.items()
    }

    # ── Risk 1: Extraction quality ────────────────────────────
    uncat_count = category_counts.get("Uncategorized", 0)
    uncat_ratio = uncat_count / total if total > 0 else 0

    if uncat_ratio > HIGH_UNCATEGORIZED:
        flags.append({
            "type": "extraction_quality",
            "severity": "High",
            "message": f"{uncat_ratio:.0%} of items are uncategorized "
                       f"({uncat_count}/{total})",
            "recommendation": "Review extraction rules or run AI classification",
        })

    # ── Risk 2: Category imbalance ────────────────────────────
    for cat, count in category_counts.items():
        if cat == "Uncategorized":
            continue
        ratio = count / total
        if ratio > DOMINANT_CATEGORY:
            flags.append({
                "type": "category_imbalance",
                "severity": "Medium",
                "message": f"'{cat}' dominates with {ratio:.0%} of all items",
                "recommendation": "Verify if this reflects the actual project scope",
            })

    # ── Risk 3: Price volatility ──────────────────────────────
    volatile_categories = ["Civil & Structural", "Electrical", "Plumbing & Drainage"]
    for vcat in volatile_categories:
        if category_counts.get(vcat, 0) > 5:
            flags.append({
                "type": "price_volatility",
                "severity": "Low",
                "message": f"'{vcat}' has {category_counts[vcat]} items — "
                           "prices in this category can fluctuate",
                "recommendation": f"Get updated market rates for {vcat} items",
            })

    # ── Risk 4: Missing quantities ────────────────────────────
    zero_qty = sum(1 for i in items if float(i.get("quantity", 0)) == 0)
    zero_ratio = zero_qty / total if total > 0 else 0

    if zero_ratio > ZERO_QTY:
        flags.append({
            "type": "missing_quantities",
            "severity": "Medium",
            "message": f"{zero_ratio:.0%} of items have zero quantity "
                       f"({zero_qty}/{total})",
            "recommendation": "Verify quantities in the original BOQ document",
        })

    # ── Calculate risk score ──────────────────────────────────
    severity_points = {"High": 30, "Medium": 15, "Low": 5}
    score = sum(severity_points.get(f["severity"], 0) for f in flags)
    score = min(score, 100)

    if score >= 60:
        risk_level = "High"
    elif score >= 30:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    result = {
        "risk_score": score,
        "risk_level": risk_level,
        "category_distribution": category_distribution,
        "flags": flags,
        "total_items_analyzed": total,
    }

    logger.info(f"Risk assessment: score={score}, level={risk_level}, flags={len(flags)}")
    return result
