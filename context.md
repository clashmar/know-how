# Code Context

## Files Retrieved
1. `/Users/lash/Personal/bishop/editor/src/menu/menu_canvas/drawing.rs` (lines 19-130) - Contains the `draw_canvas` function which renders the canvas background, template background, snap guides, and all menu elements. Also includes `draw_element` and `draw_reorder_indicator` for highlight/ghost rendering.
2. `/Users/lash/Personal/bishop/editor/src/menu/elements/layout_group.rs` (lines 24-110) - Shows how layout groups are drawn, including background panels, outline rendering, and child element drawing with special handling for dragged items (ghost effect) and drop targets.
3. `/usrash/Personal/bishop/editor/src/menu/menu_canvas/mod.rs` (lines 58-120, 200-280) - Focus on `update_canvas` showing how dragging and reordering are handled, which affects what gets drawn (e.g., ghost rendering during debug).

## Key Code
### Drawing Canvas (drawing.rs)
```rust
pub fn draw_canvas(&self, ctx: &mut WgpuContext, camera: &Camera2D, rect: Rect) {
    // Background and border
    ctx.draw_rectangle(rect.x, rect.y, rect.w, rect.h, with_theme(|theme| theme.background));
    ctx.draw_rectangle_lines(rect.x, rect.y, rect.w, rect.h, 2.0, with_theme(|theme| theme.border));
    
    // Template background
    if let Some(template) = self.current_template() {
        match template.background {
            MenuBackground::SolidColor(color) => {
                ctx.draw_rectangle(rect.x, rect.y, rect.w, rect.h, color);
            }
            MenuBackground::Dimmed(alpha) => {
                ctx.draw_rectangle(rect.x, rect.y, rect.w, rect.h, Color::new(0.0, 0.0, 0.0, alpha));
            }
            MenuBackground::None => {}
        }
        
        // Snap guides (highlight color)
        let guide_color = with_theme(|theme| theme.highlight);
        for line in &self.snap_lines {
            match line {
                SnapLine::Vertical(nx) => {
                    let screen_x = rect.x + nx * rect.w;
                    ctx.draw_rectangle(screen_x - 0.5, rect.y, 1.0, rect.h, guide_color);
                }
                SnapLine::Horizontal(ny) => {
                    let screen_y = rect.y + ny * rect.h;
                    ctx.draw_rectangle(rect.x, screen_y - 0.5, rect.w, 1.0, guide_color);
                }
            }
        }
        
        // Draw elements
        let sorted = template.sorted_element_indices();
        for i in sorted {
            let element = &template.elements[i];
            if !element.visible { continue; }
            let is_selected = self.selected_element_indices.contains(&i);
            let element_rect = normalized_rect_to_screen(element.rect, canvas_origin, canvas_size);
            self.draw_element(&mut frame, element, element_rect, is_selected, true);
        }
        
        // Placement cursor (pending element)
        if self.pending_element_type.is_some() && rect.contains(world_mouse) {
            let size = 32.0;
            let half = size / 2.0;
            ctx.draw_rectangle_lines(world_mouse.x - half, world_mouse.y - half, size, size, 2.0, with_theme(|theme| theme.primary));
        }
    }
}
```

### Layout Group Drawing (layout_group.rs)
```rust
pub(crate) fn draw_layout_group(
    &self,
    frame: &mut MenuCanvasFrame<'_>,
    element: &MenuElement,
    element_rect: Rect,
    is_selected: bool,
) {
    // Draw background panels (if any)
    for (child_idx, child) in group.children.iter().enumerate() {
        if !is_background_panel(group, child_idx) || !child.element.visible { continue; }
        if let MenuElementKind::Panel(_) = &child.element.kind {
            Panel::new(element_rect).apply_selectors(...).show(frame.ctx);
        }
    }
    
    // Outline (highlight when selected)
    if !frame.preview {
        let outline_color = if is_selected { with_theme(|t| t.highlight) } else { Color::new(0., 0., 0., 0.) };
        let thickness = if is_selected { 2.0 } else { 1.0 };
        frame.ctx.draw_rectangle_lines(element_rect.x, element_rect.y, element_rect.w, element_rect.h, thickness, outline_color);
        // Label
        let group_label = if !element.name.is_empty() { format!("[{}]", element.name) } else { "[Layout Group]".to_string() };
        frame.ctx.draw_text(&group_label, element_rect.x + 4.0, element_rect.y + 12.0, 10.0, outline_color);
    }
    
    // Draw children with ghost effect for dragged item
    for (child_idx, (child, resolved_rect)) in group.children.iter().zip(resolved.iter()).enumerate() {
        if !child.element.visible { continue; }
        let child_screen = normalized_rect_to_screen(*resolved_rect, frame.canvas_origin, frame.canvas_size);
        let is_child_selected = is_selected && self.selected_child_index == Some(child_idx);
        let child_allow_resize = !child.managed;
        
        // Ghost effect: semi-transparent black for dragged child
        if dragged_child_idx == Some(child_idx) {
            frame.ctx.draw_rectangle(child_screen.x, child_screen.y, child_screen.w, child_screen.h, Color::new(0.0, 0.0, 0.0, 0.3));
        }
        
        self.draw_element(frame, &child.element, child_screen, is_child_selected, child_allow_resize);
    }
    
    // Drop target indicator (reorder)
    if let Some(target) = drop_target {
        let managed_rects: Vec<(usize, Rect)> = group.children.iter().zip(resolved.iter()).enumerate()
            .filter(|(_, (child, _))| child.managed)
            .map(|(idx, (_, rect))| (idx, *rect))
            .collect();
        let managed_slot = group.children.iter().take(target).filter(|c| c.managed).count();
        draw_reorder_indicator(frame.ctx, &managed_rects, managed_slot, &group.layout, frame.canvas_origin, frame.canvas_size);
    }
}
```

### Reorder Indicator (drawing.rs)
```rust
pub(crate) fn draw_reorder_indicator(
    ctx: &mut WgpuContext,
    managed_rects: &[(usize, Rect)],
    managed_slot: usize,
    layout: &LayoutConfig,
    canvas_origin: Vec2,
    canvas_size: Vec2,
) {
    let indicator_color = Color::new(0.3, 0.7, 1.0, 0.9);
    let thickness = 2.0;
    // ... calculates position based on layout direction ...
    match direction {
        LayoutDirection::Vertical => {
            // ... calculate x, y, w ...
            let screen = normalized_rect_to_screen(Rect::new(x, y - 0.001, w, 0.002), canvas_origin, canvas_size);
            ctx.draw_rectangle(screen.x, screen.y, screen.w, thickness, indicator_color);
        }
        // Similar for Horizontal and Grid
    }
}
```

### Drawing Primitives Patterns
- **Rectangles**: `ctx.draw_rectangle(x, y, width, height, color)` for filled rectangles.
- **Outlined Rectangles**: `ctx.draw_rectangle_lines(x, y, width, height, thickness, color)` for strokes.
- **Color Usage**: Colors often come from themes via `with_theme(|theme| theme.property)` or explicit `Color::new(r, g, b, a)`.
- **Common Colors**: 
  - `theme.background`, `theme.border`, `theme.primary`, `theme.highlight`, `theme.text`.
  - Ghost effects use semi-transparent black: `Color::new(0.0, 0.0, 0.0, 0.3)`.
  - Drop indicators use a bright blue: `Color::new(0.3, 0.7, 1.0, 0.9)`.

## Architecture
The rendering pipeline follows this flow:
1. `MenuEditor::draw_canvas` sets up the canvas background, template background, and snap guides.
2. For each visible element in the template, it calls `draw_element` which dispatches to type-specific draw methods.
3. `draw_element` for `LayoutGroup` calls `draw_layout_group` which:
   - Renders any background panels (using `Panel::show`).
   - Draws the group outline and label.
   - Iterates through children, applying a ghost effect (semi-transparent black rectangle) to the dragged child during reorder operations.
   - Draws each child via recursive `draw_element` calls.
   - If a reorder drop target is set, draws a thin-line indicator using `draw_reorder_indicator`.
4. During drag operations (handled in `update_canvas`), visual feedback is provided by:
   - Drawing the dragged child with a ghost background.
   - Showing a reorder indicator at the potential drop location.
   - Drawing snap guides when snapping is active.

## Start Here
Start with `/Users/lash/Personal/bishop/editor/src/menu/menu_canvas/drawing.rs` because it contains the central `draw_canvas` function that orchestrates the entire canvas rendering, including background, snap guides, element iteration, and placement cursor. Understanding this file provides the overview of how all rendering pieces fit together before diving into element-specific drawing logic.