export type WhiteboardVisibility = 'workspace' | 'space' | 'private';

export interface WhiteboardPermissions {
  visibility: WhiteboardVisibility;
  viewers: string[];
  editors: string[];
}

export interface Whiteboard {
  id: string;
  orgId: string;
  name: string;
  description: string;
  teamId: string;
  createdBy: string;
  createdByName: string;
  members: string[];
  thumbnail: string;
  visibility: string;
  permissions?: WhiteboardPermissions;
  createdAt: any;
  updatedAt: any;
}

export interface WhiteboardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  style: Record<string, any>;
  linkedTaskId: string;
  createdBy: string;
  zIndex: number;
  createdAt: any;
  updatedAt: any;
}

export type ElementType = 'sticky' | 'text' | 'shape' | 'arrow' | 'task';
export type ToolMode = 'select' | 'sticky' | 'text' | 'shape' | 'arrow' | 'task';
export type ShapeType = 'rect' | 'circle' | 'diamond';

export const STICKY_COLORS = [
  '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C',
];

export const SHAPE_TYPES: { value: ShapeType; labelKey: string }[] = [
  { value: 'rect', labelKey: 'whiteboards.shapeRect' },
  { value: 'circle', labelKey: 'whiteboards.shapeCircle' },
  { value: 'diamond', labelKey: 'whiteboards.shapeDiamond' },
];
