import re
import os
import subprocess

def extract_mermaid_blocks(md_content):
    """提取所有 mermaid 代码块"""
    pattern = r'```mermaid\n(.*?)\n```'
    blocks = re.findall(pattern, md_content, re.DOTALL)
    return blocks

def render_mermaid_to_images(blocks):
    """渲染 Mermaid 代码块为图片"""
    for i, block in enumerate(blocks, 1):
        # 保存 mermaid 代码到临时文件
        mmd_file = f'mermaid_diagrams/diagram_{i}.mmd'
        png_file = f'mermaid_diagrams/diagram_{i}.png'
        
        with open(mmd_file, 'w', encoding='utf-8') as f:
            f.write(block)
        
        # 使用 mmdc 渲染
        try:
            subprocess.run([
                'mmdc', 
                '-i', mmd_file, 
                '-o', png_file,
                '-b', 'transparent',
                '-s', '2'  # scale factor
            ], check=True, capture_output=True)
            print(f"✅ 渲染完成: diagram_{i}.png")
        except subprocess.CalledProcessError as e:
            print(f"❌ 渲染失败 diagram_{i}: {e.stderr.decode()}")
        except FileNotFoundError:
            print("❌ mmdc 命令未找到，请确认 mermaid-cli 已安装")
            return False
    return True

def replace_mermaid_with_local_images(md_content):
    """替换 Mermaid 代码块为本地图片引用"""
    counter = [0]
    
    def replacer(match):
        counter[0] += 1
        return f"\n![Diagram {counter[0]}](mermaid_diagrams/diagram_{counter[0]}.png)\n"
    
    pattern = r'```mermaid\n(.*?)\n```'
    new_content = re.sub(pattern, replacer, md_content, flags=re.DOTALL)
    return new_content

# 读取原始文件
print("📖 读取 Markdown 文件...")
with open('即见平台介绍与集成指南.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取 Mermaid 代码块
print("🔍 提取 Mermaid 代码块...")
blocks = extract_mermaid_blocks(content)
print(f"   找到 {len(blocks)} 个图表")

# 渲染图片
print("🎨 渲染 Mermaid 图表...")
success = render_mermaid_to_images(blocks)

if success:
    # 替换为本地图片引用
    print("📝 更新 Markdown 文件...")
    new_content = replace_mermaid_with_local_images(content)
    
    # 保存新文件
    output_file = '即见平台介绍与集成指南_完整版.md'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✅ 完成！新文件: {output_file}")
else:
    print("❌ 渲染失败")
