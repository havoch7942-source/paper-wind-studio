extends MeshInstance3D

const DATA = preload("paper_data.gd").DATA
const PAPER_TEXTURE = preload("paper.png")
@export var playing: bool = true
@export_range(0.0, 2.0) var wind_strength: float = DATA.settings.strength
@export_range(0.0, 1.0) var gust_variation: float = DATA.settings.gust
@export_range(0.0, 1.0) var fold_resistance: float = DATA.settings.stiff
@export_range(-180.0, 180.0) var wind_direction: float = DATA.settings.direction
@export_range(0.0, 1.0) var whole_sway: float = DATA.settings.sway
@export_range(0.0, 1.0) var fold_depth: float = DATA.settings.depth
var elapsed: float = 0.0
var accumulator: float = 0.0
var event_start: float = 0.0
var event_number: int = 0
var sway_angle: float = 0.0
var sway_velocity: float = 0.0
var angles: Array[float] = []
var velocities: Array[float] = []
var groups: Array = []
var uv_points: Array[Vector2] = []
var material: StandardMaterial3D

func _ready() -> void:
	for point in DATA.vertices:
		uv_points.append(Vector2(point[0], point[1]))
	for j in range(DATA.folds.size()):
		angles.append(0.0)
		velocities.append(0.0)
		var f: Dictionary = DATA.folds[j]
		var orientation: float = atan2(f.b.y - f.a.y, f.b.x - f.a.x)
		var selected: int = -1
		for k in range(groups.size()):
			if abs(sin(orientation - groups[k].angle)) < 0.0001:
				selected = k
				break
		if selected < 0:
			groups.append({"angle": orientation, "indices": []})
			selected = groups.size() - 1
		groups[selected].indices.append(j)
	material = StandardMaterial3D.new()
	material.albedo_texture = PAPER_TEXTURE
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	material.alpha_scissor_threshold = 0.03
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.roughness = 0.9
	mesh = ArrayMesh.new()
	_update_mesh()

func _process(delta: float) -> void:
	if not playing:
		return
	accumulator += min(delta, 0.05)
	var changed: bool = false
	while accumulator >= 1.0 / 60.0:
		step_simulation(1.0 / 60.0)
		accumulator -= 1.0 / 60.0
		changed = true
	if changed:
		_update_mesh()

func _hash(n: float) -> float:
	var s: float = sin(n * 127.1 + 311.7) * 43758.5453
	return s - floor(s)

func _noise(t: float, seed_value: float) -> float:
	var i: float = floor(t)
	var f: float = t - i
	var k: float = f * f * (3.0 - 2.0 * f)
	return _hash(i + seed_value) * (1.0 - k) + _hash(i + 1.0 + seed_value) * k

func step_simulation(dt: float) -> void:
	elapsed += dt
	var force: float = wind_strength * (0.2 + 0.45 * _noise(elapsed * 0.31, 7) + gust_variation * 1.8 * pow(_noise(elapsed * 0.18, 27), 3))
	var direction: float = deg_to_rad(wind_direction)
	var duration: float = 4.0 + _hash(event_number + 103) * 3.0
	var settled: bool = true
	for j in range(angles.size()):
		if abs(angles[j]) >= 0.002 or abs(velocities[j]) >= 0.01:
			settled = false
	if elapsed - event_start > duration and settled:
		event_number += 1
		event_start = elapsed
	var active: Array = groups[event_number % groups.size()].indices if not groups.is_empty() else []
	var progress: float = clamp((elapsed - event_start) / duration, 0.0, 1.0)
	var envelope: float = pow(max(0.0, sin(PI * progress)), 1.3)
	for j in range(angles.size()):
		var f: Dictionary = DATA.folds[j]
		var orientation: float = atan2(f.b.y - f.a.y, f.b.x - f.a.x)
		var response: float = 0.65 + 0.35 * abs(cos(direction - orientation))
		var surge: float = _noise(elapsed * 0.65 - j * 0.17, 91 + j * 7)
		var target: float = f.sign * clamp(force * response * (1.8 + 3.2 * surge) + fold_depth * 0.2, 0.0, 1.35) * envelope if j in active else 0.0
		velocities[j] += ((target - angles[j]) * (24.0 + fold_resistance * 10.0) - velocities[j] * 7.0) * dt
		angles[j] += velocities[j] * dt
	var target_sway: float = (_noise(elapsed * 0.4, 201) - 0.5) * whole_sway * min(force * 1.5, 1.0) * 0.5
	sway_velocity += ((target_sway - sway_angle) * 5.0 - sway_velocity * 3.0) * dt
	sway_angle += sway_velocity * dt

func _signed(p: Vector2, f: Dictionary) -> float:
	var a: Vector2 = Vector2(f.a.x, f.a.y)
	var d: Vector2 = Vector2(f.b.x, f.b.y) - a
	return ((p.x - a.x) * d.y - (p.y - a.y) * d.x) / d.length()

func _world(p: Vector2) -> Vector3:
	return Vector3((p.x - 0.5) * DATA.size[0], (0.5 - p.y) * DATA.size[1], 0.0)

func _rotate(p: Vector3, axis: Dictionary) -> Vector3:
	return axis.a + (p - axis.a).rotated((axis.b - axis.a).normalized(), axis.angle)

func posed_vertices() -> PackedVector3Array:
	var axes: Array = []
	for j in range(DATA.folds.size()):
		var f: Dictionary = DATA.folds[j]
		var positive: int = 0
		var negative: int = 0
		for pin in DATA.pins:
			var d: float = _signed(Vector2(pin.x, pin.y), f)
			positive += 1 if d > 0.000001 else 0
			negative += 1 if d < -0.000001 else 0
		var side: int = -1 if positive > negative else 1
		var a: Vector3 = _world(Vector2(f.a.x, f.a.y))
		var b: Vector3 = _world(Vector2(f.b.x, f.b.y))
		for previous in axes:
			if _signed(Vector2(f.a.x, f.a.y), previous.fold) * previous.side > 0.00000001:
				a = _rotate(a, previous)
			if _signed(Vector2(f.b.x, f.b.y), previous.fold) * previous.side > 0.00000001:
				b = _rotate(b, previous)
		axes.append({"a": a, "b": b, "fold": f, "side": side, "angle": 0.0 if positive > 0 and negative > 0 else angles[j] * side})
	var anchor: Vector2 = Vector2(0.5, 0.0)
	if not DATA.pins.is_empty():
		anchor = Vector2(DATA.pins[0].x, DATA.pins[0].y)
	var pivot: Vector3 = _world(anchor)
	var result: PackedVector3Array = PackedVector3Array()
	for point in uv_points:
		var q: Vector3 = _world(point)
		for axis in axes:
			if _signed(point, axis.fold) * axis.side > 0.00000001:
				q = _rotate(q, axis)
		if DATA.pins.size() <= 1:
			q = pivot + (q - pivot).rotated(Vector3(0, 0, 1), sway_angle)
		result.append(q)
	return result

func _update_mesh() -> void:
	var positions: PackedVector3Array = posed_vertices()
	var normals: PackedVector3Array = PackedVector3Array()
	var uvs: PackedVector2Array = PackedVector2Array()
	for i in range(0, positions.size(), 3):
		var normal: Vector3 = -(positions[i + 1] - positions[i]).cross(positions[i + 2] - positions[i]).normalized()
		for j in range(3):
			normals.append(normal)
			uvs.append(uv_points[i + j])
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = positions
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	var target: ArrayMesh = mesh as ArrayMesh
	target.clear_surfaces()
	target.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	target.surface_set_material(0, material)
