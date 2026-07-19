"""Local-only browser import normalization and validation."""

from .core import (
    SCHEMA_VERSION,
    classify_category,
    deduplicate_features,
    normalize_feature,
    validate_dataset,
)

__all__ = [
    "SCHEMA_VERSION",
    "classify_category",
    "deduplicate_features",
    "normalize_feature",
    "validate_dataset",
]
