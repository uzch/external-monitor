from __future__ import annotations

from functools import lru_cache

from fastembed import TextEmbedding

from .config import settings


class EmbeddingUnavailable(RuntimeError):
    pass


@lru_cache
def _model() -> TextEmbedding:
    return TextEmbedding(model_name=settings.embedding_model)


def embed_text(text: str) -> list[float]:
    try:
        vector = next(_model().embed([text]))
    except Exception as error:
        raise EmbeddingUnavailable(f"Embedding model is unavailable: {error}") from error
    return vector.tolist()
