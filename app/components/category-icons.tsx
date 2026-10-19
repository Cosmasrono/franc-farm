import { Activity, Baby, Bandage, ClipboardPlus, Droplets, HeartPulse, Leaf, Pill, Sparkles, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import type { ProductCategory } from '@/app/lib/products';

export const CATEGORY_ICON: Record<ProductCategory, LucideIcon> = {
  'Prescription medicines': ClipboardPlus,
  'Pain & fever': Thermometer,
  'Cough, cold & flu': Wind,
  'Digestive health': Activity,
  'Vitamins & supplements': Leaf,
  'First aid': Bandage,
  'Skin care': Droplets,
  'Mother & baby': Baby,
  'Personal care': Sparkles,
  'Medical devices': HeartPulse,
};

export function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  const Icon = CATEGORY_ICON[category as ProductCategory] || Pill;
  return <Icon size={size} aria-hidden="true" />;
}
