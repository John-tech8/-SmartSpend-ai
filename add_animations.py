import os
import re

html_files = [f for f in os.listdir('frontend') if f.endswith('.html')]

for f_name in html_files:
    path = os.path.join('frontend', f_name)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add animate-on-scroll to key cards and containers
    pattern = r'class="([^"]*(?:feature-card|glass-card|results-card|chart-container|summary-container|score-card|insights-panel|metric-card|monthly-report-card)[^"]*)"'
    
    def replacer(match):
        classes = match.group(1)
        if 'animate-on-scroll' not in classes:
            return f'class="{classes} animate-on-scroll"'
        return match.group(0)
        
    new_content = re.sub(pattern, replacer, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f'Updated classes in {f_name}')
