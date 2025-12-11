class CategoryModel {
  final String id;
  final String name;
  final String icon;
  final String description;
  final int tutorCount;

  CategoryModel({
    required this.id,
    required this.name,
    required this.icon,
    this.description = '',
    this.tutorCount = 0,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    try {
      return CategoryModel(
        id: json['_id']?.toString() ?? '',
        name: json['name']?.toString() ?? 'Unknown',
        icon: json['icon']?.toString() ?? '📚',
        description: json['description']?.toString() ?? '',
        tutorCount: json['tutorCount'] ?? 0,
      );
    } catch (e) {
      print('❌ Error parsing CategoryModel: $e');
      print('JSON: $json');
      // Return default category instead of throwing
      return CategoryModel(
        id: json['_id']?.toString() ?? '',
        name: 'Unknown',
        icon: '📚',
      );
    }
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'icon': icon,
      'description': description,
      'tutorCount': tutorCount,
    };
  }
}