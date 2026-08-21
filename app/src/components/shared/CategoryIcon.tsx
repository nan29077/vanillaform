"use client";

import {
  Tag, Shirt, Palette, Leaf, Gem, Home as HomeIcon, Laptop, Baby, Dumbbell, Plane, Dog, BookOpen,
  Headphones, Camera, Coffee, Utensils, Heart, ShoppingBag, Music, Gamepad2, Car, Bike,
  Flower2, Scissors, Watch, Glasses, Wine, Cake, Pizza, IceCream, Apple, Carrot, Fish,
  Stethoscope, Pill, Gift, Sparkles, Sun, Moon, Umbrella, Tent, Mountain, Waves,
  Paintbrush, Brush, Wrench, Hammer, Lightbulb, Smartphone, Tv, Monitor, Printer, Wifi,
  Footprints, Crown, Ribbon, Star, Zap, Theater, Clapperboard, Mic, Radio, Globe,
  Map, Compass, Anchor, Rocket, Flag, Trophy,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Shirt, Palette, Leaf, Gem, HomeIcon, Laptop, Baby, Dumbbell, Plane, Dog, BookOpen,
  Headphones, Camera, Coffee, Utensils, Heart, Tag, ShoppingBag, Music, Gamepad2, Car, Bike,
  Flower2, Scissors, Watch, Glasses, Wine, Cake, Pizza, IceCream, Apple, Carrot, Fish,
  Stethoscope, Pill, Gift, Sparkles, Sun, Moon, Umbrella, Tent, Mountain, Waves,
  Paintbrush, Brush, Wrench, Hammer, Lightbulb, Smartphone, Tv, Monitor, Printer, Wifi,
  Footprints, Crown, Ribbon, Star, Zap, Theater, Clapperboard, Mic, Radio, Globe,
  Map, Compass, Anchor, Rocket, Flag, Trophy,
};

// 슬러그 → 아이콘 이름 폴백 맵
const SLUG_FALLBACK: Record<string, string> = {
  fashion: "Shirt", beauty: "Palette", lifestyle: "Leaf", accessories: "Gem",
  "home-living": "HomeIcon", food: "Utensils", digital: "Laptop", kids: "Baby",
  sports: "Dumbbell", travel: "Plane", pet: "Dog", books: "BookOpen",
  audio: "Headphones", photo: "Camera", cafe: "Coffee", health: "Stethoscope",
  skincare: "Heart", perfume: "Flower2", shoes: "Footprints", bag: "ShoppingBag",
  watch: "Watch", kitchen: "Utensils", camping: "Tent", game: "Gamepad2",
  car: "Car", dessert: "Cake", wine: "Wine", craft: "Scissors",
  movie: "Clapperboard", gardening: "Flower2", gift: "Gift",
  music: "Music", art: "Paintbrush", outdoor: "Mountain", swim: "Waves",
  supplement: "Pill", interior: "Lightbulb", electronics: "Smartphone",
  yoga: "Leaf", fitness: "Dumbbell",
};

interface CategoryIconProps {
  iconName?: string | null;
  slug?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function CategoryIcon({ iconName, slug, size = 20, strokeWidth = 1.5, className }: CategoryIconProps) {
  // 1) DB에 저장된 icon name 우선
  // 2) 없으면 slug 기반 폴백
  // 3) 그래도 없으면 Tag
  const resolvedName = iconName || (slug ? SLUG_FALLBACK[slug] : null) || "Tag";
  const Icon = ICON_MAP[resolvedName] || Tag;

  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}
