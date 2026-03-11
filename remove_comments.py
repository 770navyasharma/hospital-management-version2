import os
import re
import sys

def remove_comments_from_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    ext = os.path.splitext(filepath)[1].lower()
    original_content = content

    if ext == '.py':
        # Remove full line comments starting with #
        content = re.sub(r'^\s*#.*?\n', '', content, flags=re.MULTILINE)
        # We don't remove inline # comments easily without regex breaking strings, 
        # but let's remove safe inline comments (space followed by #)
        content = re.sub(r' +\# .*?$', '', content, flags=re.MULTILINE)
    
    elif ext in ['.html']:
        # Remove <!-- --> comments
        content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
        # For `<style>` and `<script>` blocks we should ideally process them separately, 
        # but relying on simple regex for inline JS/CSS might be risky. We'll stick to HTML comments here.
    
    elif ext in ['.js', '.css']:
        # Remove /* */ block comments
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        # Remove // single line comments (being careful not to break URLs like http://)
        # Must have whitespace or start of line before //
        content = re.sub(r'(^|\s+)//.*?$', r'\1', content, flags=re.MULTILINE)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def clean_project(directory):
    count = 0
    for root, dirs, files in os.walk(directory):
        # exclude git, venv, pycache, static uploads etc if needed
        if '.git' in root or '__pycache__' in root or 'venv' in root:
            continue
        for file in files:
            if file.endswith(('.py', '.js', '.css', '.html')):
                filepath = os.path.join(root, file)
                if remove_comments_from_file(filepath):
                    count += 1
    print(f"Cleaned comments from {count} files.")

if __name__ == '__main__':
    project_dir = "/Users/navyasharma/Developer/Projects/hospital-management-version2/app"
    clean_project(project_dir)
