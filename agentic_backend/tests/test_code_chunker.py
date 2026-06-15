"""Unit tests for the Tree-sitter based code chunker."""
import pytest
from app.rag.code_chunker import chunk_code, _get_lang_key, _is_pure_punctuation


# ── _is_pure_punctuation ─────────────────────────────────────────────────

class TestIsPurePunctuation:
    def test_empty(self):
        assert _is_pure_punctuation("") is False

    def test_only_punct(self):
        assert _is_pure_punctuation(";") is True
        assert _is_pure_punctuation(";;") is True
        assert _is_pure_punctuation("{}") is True

    def test_with_alnum(self):
        assert _is_pure_punctuation("x;") is False
        assert _is_pure_punctuation(";a") is False

    def test_whitespace_only(self):
        assert _is_pure_punctuation("   ") is False


# ── _get_lang_key ────────────────────────────────────────────────────────

class TestGetLangKey:
    def test_known_languages(self):
        assert _get_lang_key("python") == "python"
        assert _get_lang_key("java") == "java"
        assert _get_lang_key("cpp") == "cpp"
        assert _get_lang_key("c") == "c"
        assert _get_lang_key("kotlin") == "kotlin"
        assert _get_lang_key("typescript") == "typescript"
        assert _get_lang_key("javascript") == "javascript"

    def test_aliases(self):
        assert _get_lang_key("py") == "python"
        assert _get_lang_key("ts") == "typescript"
        assert _get_lang_key("js") == "javascript"
        assert _get_lang_key("kt") == "kotlin"

    def test_unsupported(self):
        assert _get_lang_key("rust") is None
        assert _get_lang_key("go") is None
        assert _get_lang_key("ruby") is None
        assert _get_lang_key("swift") is None
        assert _get_lang_key("php") is None
        assert _get_lang_key("csharp") is None


# ── chunk_code: Python ───────────────────────────────────────────────────

PYTHON_SAMPLE = """
import os
import sys

def greet(name):
    return f"Hello {name}"

class Calculator:
    def add(self, a, b):
        return a + b

    def sub(self, a, b):
        return a - b

x = 42
"""


class TestPythonChunks:
    def test_python_imports(self):
        chunks = chunk_code(PYTHON_SAMPLE, "python")
        imports = [c for c in chunks if c.startswith("import")]
        assert len(imports) >= 1
        assert any("import os" in c for c in imports)
        assert any("import sys" in c for c in imports)

    def test_python_function(self):
        chunks = chunk_code(PYTHON_SAMPLE, "python")
        funcs = [c for c in chunks if c.startswith("def")]
        assert len(funcs) == 1
        assert "greet" in funcs[0]

    def test_python_class(self):
        chunks = chunk_code(PYTHON_SAMPLE, "python")
        classes = [c for c in chunks if c.startswith("class")]
        assert len(classes) == 1
        assert "Calculator" in classes[0]
        assert "add" in classes[0]

    def test_python_trailing(self):
        chunks = chunk_code(PYTHON_SAMPLE, "python")
        all_text = "\n".join(chunks)
        assert "x = 42" in all_text


# ── chunk_code: Java ─────────────────────────────────────────────────────

JAVA_SAMPLE = """
package com.example;

import java.util.List;
import java.util.Map;

public class App {
    private String name;

    public String greet(String n) {
        return "Hi " + n;
    }
}
"""


class TestJavaChunks:
    def test_java_package(self):
        chunks = chunk_code(JAVA_SAMPLE, "java")
        pkgs = [c for c in chunks if c.startswith("package")]
        assert len(pkgs) == 1

    def test_java_imports(self):
        chunks = chunk_code(JAVA_SAMPLE, "java")
        imports = [c for c in chunks if c.startswith("import")]
        assert len(imports) >= 1

    def test_java_class(self):
        chunks = chunk_code(JAVA_SAMPLE, "java")
        classes = [c for c in chunks if c.startswith("public class") or c.startswith("class")]
        assert len(classes) == 1
        assert "App" in classes[0]
        assert "greet" in classes[0]


# ── chunk_code: C++ ──────────────────────────────────────────────────────

CPP_SAMPLE = """
#include <iostream>
#include <vector>

class Calc {
public:
    int add(int a, int b) {
        return a + b;
    }
};

int main() {
    return 0;
}
"""


class TestCppChunks:
    def test_cpp_includes(self):
        chunks = chunk_code(CPP_SAMPLE, "cpp")
        includes = [c for c in chunks if c.startswith("#include")]
        assert len(includes) >= 1

    def test_cpp_class(self):
        chunks = chunk_code(CPP_SAMPLE, "cpp")
        classes = [c for c in chunks if "class Calc" in c or "Calc" in c]
        assert len(classes) >= 1

    def test_cpp_no_punct_chunks(self):
        chunks = chunk_code(CPP_SAMPLE, "cpp")
        punct = [c for c in chunks if _is_pure_punctuation(c)]
        assert len(punct) == 0


# ── chunk_code: Kotlin ───────────────────────────────────────────────────

KOTLIN_SAMPLE = """
package com.example

class Calc {
    fun add(a: Int, b: Int): Int {
        return a + b
    }
}

fun helper() = "ok"
"""


class TestKotlinChunks:
    def test_kotlin_package(self):
        chunks = chunk_code(KOTLIN_SAMPLE, "kotlin")
        pkgs = [c for c in chunks if c.startswith("package")]
        assert len(pkgs) == 1

    def test_kotlin_class(self):
        chunks = chunk_code(KOTLIN_SAMPLE, "kotlin")
        classes = [c for c in chunks if c.startswith("class")]
        assert len(classes) == 1

    def test_kotlin_function(self):
        chunks = chunk_code(KOTLIN_SAMPLE, "kotlin")
        funcs = [c for c in chunks if c.startswith("fun")]
        assert len(funcs) >= 1


# ── chunk_code: TypeScript ───────────────────────────────────────────────

TS_SAMPLE = """
import { Component } from 'react';

interface Props {
    name: string;
}

class App extends Component<Props> {
    render() {
        return null;
    }
}

function helper(): void {}
"""


class TestTypeScriptChunks:
    def test_ts_import(self):
        chunks = chunk_code(TS_SAMPLE, "typescript")
        imports = [c for c in chunks if c.startswith("import")]
        assert len(imports) == 1

    def test_ts_interface(self):
        chunks = chunk_code(TS_SAMPLE, "typescript")
        merged_text = "\n".join(chunks)
        assert "interface Props" in merged_text

    def test_ts_class(self):
        chunks = chunk_code(TS_SAMPLE, "typescript")
        classes = [c for c in chunks if c.startswith("class")]
        assert len(classes) == 1

    def test_ts_function(self):
        chunks = chunk_code(TS_SAMPLE, "typescript")
        funcs = [c for c in chunks if c.startswith("function")]
        assert len(funcs) == 1

    def test_ts_at_least_3_chunks(self):
        chunks = chunk_code(TS_SAMPLE, "typescript")
        assert len(chunks) >= 3


# ── chunk_code: JavaScript ───────────────────────────────────────────────

JS_SAMPLE = """
import { foo } from 'bar';

function greet(name) {
    return `Hi ${name}`;
}

class MyClass {
    constructor() {
        this.x = 1;
    }
}
"""


class TestJavaScriptChunks:
    def test_js_import(self):
        chunks = chunk_code(JS_SAMPLE, "javascript")
        imports = [c for c in chunks if c.startswith("import")]
        assert len(imports) == 1

    def test_js_function(self):
        chunks = chunk_code(JS_SAMPLE, "javascript")
        funcs = [c for c in chunks if c.startswith("function")]
        assert len(funcs) == 1

    def test_js_class(self):
        chunks = chunk_code(JS_SAMPLE, "javascript")
        classes = [c for c in chunks if c.startswith("class")]
        assert len(classes) == 1


# ── chunk_code: edge cases ───────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_source(self):
        assert chunk_code("", "python") == []
        assert chunk_code("   ", "python") == []

    def test_unsupported_language(self):
        source = 'fn main() { println!("hello"); }'
        chunks = chunk_code(source, "rust")
        assert chunks == [source]

    def test_single_line(self):
        chunks = chunk_code("x = 1", "python")
        assert len(chunks) >= 1

    def test_multiple_classes(self):
        source = """
class A:
    pass

class B:
    pass
"""
        chunks = chunk_code(source, "python")
        classes = [c for c in chunks if c.startswith("class")]
        assert len(classes) == 2
