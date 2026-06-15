"""
Simple CLI Todo List App
Demo: Ask the AI to add a calendar / due-date feature.
"""
import json
import os
from datetime import datetime

DATA_FILE = os.path.join(os.path.dirname(__file__), "todos.json")


def load_todos() -> list[dict]:
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def save_todos(todos: list[dict]):
    with open(DATA_FILE, "w") as f:
        json.dump(todos, f, indent=2)


def add(title: str):
    todos = load_todos()
    todos.append({
        "id": max([t["id"] for t in todos], default=0) + 1,
        "title": title,
        "done": False,
        "created_at": datetime.now().isoformat(),
    })
    save_todos(todos)
    print("[OK] Added: " + title)


def list_todos(show_all: bool = False):
    todos = load_todos()
    if not todos:
        print('[!] No todos yet. Add one with: python todo.py add "your task"')
        return
    for t in todos:
        if not show_all and t["done"]:
            continue
        status = "[X]" if t["done"] else "[ ]"
        print(f"  {status} [{t['id']:3d}] {t['title']}")
        if "due_date" in t:
            print("          [Calendar] Due: " + str(t["due_date"]))


def done(todo_id: int):
    todos = load_todos()
    for t in todos:
        if t["id"] == todo_id:
            t["done"] = True
            save_todos(todos)
            print(f"[OK] Marked #{todo_id} as done")
            return
    print(f"[!] Todo #{todo_id} not found")


def delete(todo_id: int):
    todos = load_todos()
    new_todos = [t for t in todos if t["id"] != todo_id]
    if len(new_todos) == len(todos):
        print(f"[!] Todo #{todo_id} not found")
        return
    save_todos(new_todos)
    print(f"[DEL] Deleted #{todo_id}")


def main():
    import sys
    args = sys.argv[1:]
    if not args:
        print("Usage:")
        print('  python todo.py add "Buy milk"')
        print("  python todo.py list")
        print("  python todo.py list --all")
        print("  python todo.py done <id>")
        print("  python todo.py delete <id>")
        return

    cmd = args[0]
    if cmd == "add":
        if len(args) < 2:
            print('Usage: python todo.py add "task description"')
            return
        add(args[1])
    elif cmd == "list":
        show_all = "--all" in args
        list_todos(show_all)
    elif cmd == "done":
        if len(args) < 2 or not args[1].isdigit():
            print("Usage: python todo.py done <id>")
            return
        done(int(args[1]))
    elif cmd == "delete":
        if len(args) < 2 or not args[1].isdigit():
            print("Usage: python todo.py delete <id>")
            return
        delete(int(args[1]))
    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()
