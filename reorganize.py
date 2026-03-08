import os
import shutil
import glob
import re

root_dir = r"c:\Users\Roshan g\OneDrive\Desktop\SmartSpend-ai"
frontend_dir = os.path.join(root_dir, "frontend")

# 1. Ensure target directories exist
for folder in ["css", "js", "assets"]:
    os.makedirs(os.path.join(root_dir, folder), exist_ok=True)

# 2. Move HTML files
for html_file in glob.glob(os.path.join(frontend_dir, "*.html")):
    dest = os.path.join(root_dir, os.path.basename(html_file))
    shutil.move(html_file, dest)

# 3. Move CSS files
if os.path.exists(os.path.join(frontend_dir, "css")):
    for css_file in glob.glob(os.path.join(frontend_dir, "css", "*.css")):
        dest = os.path.join(root_dir, "css", os.path.basename(css_file))
        shutil.move(css_file, dest)

# Rename main.css to styles.css
main_css_path = os.path.join(root_dir, "css", "main.css")
styles_css_path = os.path.join(root_dir, "css", "styles.css")
if os.path.exists(main_css_path):
    # remove styles.css if exists before renaming to avoid FileExistsError
    if os.path.exists(styles_css_path):
        os.remove(styles_css_path)
    os.rename(main_css_path, styles_css_path)

# 4. Move JS files
if os.path.exists(os.path.join(frontend_dir, "js")):
    for js_file in glob.glob(os.path.join(frontend_dir, "js", "**", "*.js"), recursive=True):
        dest = os.path.join(root_dir, "js", os.path.basename(js_file))
        
        if os.path.exists(dest):
            # If a file already exists at dest, only overwrite if the new one has content and the old one is empty
            if os.path.getsize(dest) == 0 and os.path.getsize(js_file) > 0:
                os.remove(dest)
                shutil.move(js_file, dest)
            else:
                pass # keep existing file
        else:
            shutil.move(js_file, dest)

# Move i18n
locales_i18n = os.path.join(frontend_dir, "locales", "i18n.js")
dest_i18n = os.path.join(root_dir, "js", "i18n.js")
if os.path.exists(locales_i18n):
    if os.path.exists(dest_i18n):
       if os.path.getsize(dest_i18n) == 0:
           os.remove(dest_i18n)
           shutil.move(locales_i18n, dest_i18n)
    else:
        shutil.move(locales_i18n, dest_i18n)

# 5. Move assets
if os.path.exists(os.path.join(frontend_dir, "assets")):
    for item in os.listdir(os.path.join(frontend_dir, "assets")):
        src = os.path.join(frontend_dir, "assets", item)
        dest = os.path.join(root_dir, "assets", item)
        if not os.path.exists(dest):
            shutil.move(src, dest)
        else:
            if os.path.isdir(src):
                shutil.copytree(src, dest, dirs_exist_ok=True)
                shutil.rmtree(src)

# 6. Create _redirects
redirects_path = os.path.join(root_dir, "_redirects")
with open(redirects_path, 'w', encoding='utf-8') as f:
    f.write("/* /index.html 200\n")

# 7. Update HTML files contents
for html_file in glob.glob(os.path.join(root_dir, "*.html")):
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace css/main.css with css/styles.css
    content = content.replace("css/main.css", "css/styles.css")
    
    # Replace locales/i18n.js with js/i18n.js
    content = content.replace("locales/i18n.js", "js/i18n.js")
    
    # Replace js/pages/xyz.js with js/xyz.js
    content = content.replace("js/pages/", "js/")
    
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Reorganization complete.")
