"""
scoring/weights.py

Scoring constants — weights, persona multipliers, backup modifiers, thresholds.
All values from ARCHITECTURE.md.
"""

# Signal weights (must sum to 1.0)
WEIGHTS: dict[str, float] = {
    "grid":     0.35,
    "heat":     0.25,
    "wildfire": 0.20,
    "flood":    0.10,
    "history":  0.10,
}

# Condition-based risk multipliers
CONDITION_MULTIPLIERS: dict[str, float] = {
    "ventilator":     1.5,
    "oxygen":         1.3,
    "dialysis":       1.2,
    "wheelchair":     1.1,
    "heat_vulnerable": 1.0,
    "insulin_dependent": 1.1,
    "other":          1.0,
}

# Backup power modifiers (additive to base score, expressed as multiplier on weighted score)
# <2 hrs backup → +30%; 12 hrs+ backup → -20%
BACKUP_NO_POWER_BOOST: float = 1.30    # backup_hours == 0 or None
BACKUP_MINIMAL_BOOST: float = 1.15     # backup_hours < 2
BACKUP_STRONG_REDUCTION: float = 0.80  # backup_hours >= 12
BACKUP_THRESHOLD_NONE: float = 0.0
BACKUP_THRESHOLD_MINIMAL: float = 2.0
BACKUP_THRESHOLD_STRONG: float = 12.0

# Risk level thresholds (composite score 0-100)
RISK_LEVELS = [
    (95, "CRITICAL"),
    (80, "HIGH"),
    (60, "ELEVATED"),
    (35, "MODERATE"),
    (0,  "LOW"),
]

# Alert pipeline triggers
ALERT_THRESHOLD: int = 60       # Score >= this triggers advisory pipeline
ESCALATION_THRESHOLD: int = 80  # Score >= this triggers immediate escalation
CRITICAL_THRESHOLD: int = 95    # Score >= this triggers emergency response
