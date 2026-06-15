import logging

from tree_sitter import Language, Parser
import tree_sitter_python, tree_sitter_java, tree_sitter_cpp, tree_sitter_kotlin
import tree_sitter_typescript, tree_sitter_javascript

logger = logging.getLogger(__name__)


# ── Tree-sitter language registry ───────────────────────────────────────

_TS_LANGUAGES = {
    "python":     Language(tree_sitter_python.language()),
    "java":       Language(tree_sitter_java.language()),
    "cpp":        Language(tree_sitter_cpp.language()),
    "c":          Language(tree_sitter_cpp.language()),
    "kotlin":     Language(tree_sitter_kotlin.language()),
    "typescript": Language(tree_sitter_typescript.language_typescript()),
    "tsx":        Language(tree_sitter_typescript.language_tsx()),
    "javascript": Language(tree_sitter_javascript.language()),
}

# Node types that form chunk boundaries per language
_CHUNK_NODES = {
    "python":     {"function_definition", "class_definition", "import_statement"},
    "java":       {"method_declaration", "class_declaration", "interface_declaration",
                    "import_declaration"},
    "cpp":        {"function_definition", "class_specifier", "struct_specifier",
                    "enum_specifier", "preproc_include"},
    "c":          {"function_definition", "struct_specifier", "enum_specifier",
                    "preproc_include"},
    "kotlin":     {"function_declaration", "class_declaration", "interface_declaration",
                    "object_declaration", "package_header", "import_header"},
    "typescript": {"function_declaration", "class_declaration", "interface_declaration",
                    "enum_declaration", "import_statement", "type_alias_declaration",
                    "lexical_declaration"},
    "tsx":        {"function_declaration", "class_declaration", "interface_declaration",
                    "enum_declaration", "import_statement", "type_alias_declaration",
                    "lexical_declaration"},
    "javascript": {"function_declaration", "class_declaration", "import_statement",
                    "lexical_declaration", "expression_statement"},
}

# Languages supported by Tree-sitter (AST-chunked)
_TS_SUPPORTED = set(_TS_LANGUAGES.keys())


def _get_lang_key(language: str) -> str | None:
    lang = language.lower()
    if lang in _TS_LANGUAGES:
        return lang
    if lang in ("py", "python3"):
        return "python"
    if lang in ("ts", "arkts"):
        return "typescript"
    if lang == "tsx":
        return "tsx"
    if lang in ("js", "javascript", "node"):
        return "javascript"
    if lang in ("kt", "kts"):
        return "kotlin"
    if lang in ("cpp", "cxx", "cc", "hpp"):
        return "cpp"
    if lang in ("c", "h"):
        return "c"
    return None


def _is_pure_punctuation(text: str) -> bool:
    stripped = text.strip()
    return bool(stripped) and not any(ch.isalnum() for ch in stripped)


def treesitter_chunk(source: str, language: str) -> list[str]:
    """
    Tree-sitter AST-based code chunker.
    Chunks are determined by AST node boundaries :NOT by character count.
    Each function, class, method, import, etc. becomes its own chunk.
    """
    lang_key = _get_lang_key(language)
    if lang_key is None:
        logger.warning("No tree-sitter grammar for '%s' :indexing entire file as one chunk", language)
        return [source]
    if not source.strip():
        return []

    ts_lang = _TS_LANGUAGES[lang_key]
    chunk_nodes = _CHUNK_NODES[lang_key]

    parser = Parser(ts_lang)
    try:
        tree = parser.parse(source.encode("utf-8"))
    except Exception as exc:
        logger.warning("Tree-sitter parse failed for '%s': %s :fallback to single chunk", language, exc)
        return [source]

    root = tree.root_node

    # Collect (text, is_declaration) pairs
    pairs: list[tuple[str, bool]] = []
    prev_end_byte = 0

    for child in root.children:
        if child.type in chunk_nodes:
            # Glue text between previous boundary and this node
            if child.start_byte > prev_end_byte:
                between = source[prev_end_byte:child.start_byte]
                stripped = between.strip()
                if stripped and not _is_pure_punctuation(stripped):
                    pairs.append((stripped, False))

            # Declaration node itself
            node_text = source[child.start_byte:child.end_byte].strip()
            if node_text:
                pairs.append((node_text, True))

            prev_end_byte = child.end_byte

    # Trailing code after the last node
    if prev_end_byte < len(source):
        remaining = source[prev_end_byte:].strip()
        if remaining and not _is_pure_punctuation(remaining):
            pairs.append((remaining, False))

    # Build final chunks:
    #   - Declaration chunks always start a new chunk (never merge two declarations).
    #   - Small glue chunks (< 40 chars) are absorbed into the preceding chunk.
    #   - Larger glue chunks stand as their own chunk.
    merged: list[str] = []
    for text, is_decl in pairs:
        if is_decl:
            merged.append(text)
        else:
            if merged and len(text) < 40:
                merged[-1] = merged[-1] + "\n" + text
            else:
                merged.append(text)

    return merged


def chunk_code(source: str, language: str) -> list[str]:
    """
    Unified code chunking API.
    Uses Tree-sitter AST for all supported languages, chunks are
    dynamically sized based on the AST structure (function/class/etc. boundaries).
    Falls back to returning the full source as one chunk on failure.
    """
    return treesitter_chunk(source, language)
