import logging

from tree_sitter import Language, Parser
import tree_sitter_python, tree_sitter_java, tree_sitter_cpp, tree_sitter_kotlin
import tree_sitter_typescript, tree_sitter_javascript
import tree_sitter_html, tree_sitter_css, tree_sitter_json, tree_sitter_markdown

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
    "html":       Language(tree_sitter_html.language()),
    "css":        Language(tree_sitter_css.language()),
    "json":       Language(tree_sitter_json.language()),
    "markdown":   Language(tree_sitter_markdown.language()),
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
    "html":  {"doctype", "element"},
    "css":   {"rule_set", "media_statement"},
    "json":  {"pair"},
    "markdown": {"atx_heading", "setext_heading", "code_block", "fenced_code_block"},
}

_DEEP_CHUNK = {"json"}

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
    if lang in ("html", "htm", "xhtml"):
        return "html"
    if lang in ("css", "scss", "less"):
        return "css"
    if lang in ("json",):
        return "json"
    if lang in ("md", "markdown", "mdown"):
        return "markdown"
    return None


def _is_pure_punctuation(text: str) -> bool:
    stripped = text.strip()
    return bool(stripped) and not any(ch.isalnum() for ch in stripped)


def _find_chunk_container(node, chunk_nodes):
    """Walk into wrapper nodes (e.g. <html>, JSON object/array) to find
    the level where direct children are the actual chunk nodes."""
    for child in node.children:
        if any(c.type in chunk_nodes for c in child.children):
            return child
    return node


def _recursive_chunks(root, source, chunk_nodes):
    """Walk the tree recursively collecting text between chunk node boundaries."""
    chunks: list[str] = []
    prev_end = 0

    def walk(node):
        nonlocal prev_end
        if node.type in chunk_nodes:
            if node.start_byte > prev_end:
                between = source[prev_end:node.start_byte].strip()
                if between:
                    chunks.append(between)
            text = source[node.start_byte:node.end_byte].strip()
            if text:
                chunks.append(text)
            prev_end = node.end_byte
        else:
            for c in node.children:
                walk(c)

    walk(root)
    if prev_end < len(source):
        remaining = source[prev_end:].strip()
        if remaining:
            chunks.append(remaining)
    return chunks


def _html_tree_chunks(root, source, chunk_nodes):
    body_el = None
    stack = [root]
    while stack and body_el is None:
        n = stack.pop()
        if n.type == "start_tag":
            for c in n.children:
                if c.type == "tag_name":
                    tag = source[c.start_byte:c.end_byte].decode() if isinstance(source, bytes) else source[c.start_byte:c.end_byte]
                    if tag == "body" and n.parent and n.parent.type == "element":
                        body_el = n.parent
                        break
        stack.extend(n.children)

    if body_el is None:
        return _recursive_chunks(root, source, chunk_nodes)

    chunks: list[str] = []
    prev_end = 0
    for child in body_el.children:
        if child.type in chunk_nodes:
            if child.start_byte > prev_end:
                between = source[prev_end:child.start_byte].strip()
                if between:
                    chunks.append(between)
            text = source[child.start_byte:child.end_byte].strip()
            if text:
                chunks.append(text)
            prev_end = child.end_byte
    if prev_end < len(source):
        remaining = source[prev_end:].strip()
        if remaining:
            chunks.append(remaining)
    return chunks


def treesitter_chunk(source: str, language: str) -> list[str]:
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

    if lang_key == "markdown":
        return _recursive_chunks(root, source, chunk_nodes)
    if lang_key == "html":
        return _html_tree_chunks(root, source, chunk_nodes)
    if lang_key in _DEEP_CHUNK:
        container = _find_chunk_container(root, chunk_nodes)
    else:
        container = root

    pairs: list[tuple[str, bool]] = []
    prev_end_byte = 0

    for child in container.children:
        if child.type in chunk_nodes:
            if child.start_byte > prev_end_byte:
                between = source[prev_end_byte:child.start_byte]
                stripped = between.strip()
                if stripped and not _is_pure_punctuation(stripped):
                    pairs.append((stripped, False))

            node_text = source[child.start_byte:child.end_byte].strip()
            if node_text:
                pairs.append((node_text, True))

            prev_end_byte = child.end_byte

    if prev_end_byte < len(source):
        remaining = source[prev_end_byte:].strip()
        if remaining and not _is_pure_punctuation(remaining):
            pairs.append((remaining, False))

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
