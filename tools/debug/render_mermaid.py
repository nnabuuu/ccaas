import re
import urllib.parse
import base64
import os

def extract_mermaid_blocks(md_content):
    """提取所有 mermaid 代码块"""
    pattern = r'```mermaid\n(.*?)\n```'
    blocks = re.findall(pattern, md_content, re.DOTALL)
    return blocks

def mermaid_to_url(mermaid_code):
    """将 Mermaid 代码转换为 mermaid.ink URL"""
    # 编码为 base64
    encoded = base64.b64encode(mermaid_code.encode('utf-8')).decode('utf-8')
    # 使用 mermaid.ink API
    return f"https://mermaid.ink/img/{encoded}"

def replace_mermaid_with_images(md_content):
    """替换 Mermaid 代码块为图片链接"""
    counter = [0]  # 使用列表来在闭包中修改
    
    def replacer(match):
        counter[0] += 1
        mermaid_code = match.group(1)
        img_url = mermaid_to_url(mermaid_code)
        return f"![Diagram {counter[0]}]({img_url})"
    
    pattern = r'```mermaid\n(.*?)\n```'
    new_content = re.sub(pattern, replacer, md_content, flags=re.DOTALL)
    return new_content

# 读取原始文件
with open('即见平台介绍与集成指南.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 替换 Mermaid 为图片
new_content = replace_mermaid_with_images(content)

# 保存新文件
with open('即见平台介绍与集成指南_带图.md', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ Mermaid 图表已转换为图片链接")
print(f"✅ 新文件: 即见平台介绍与集成指南_带图.md")
