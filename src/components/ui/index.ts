/*
 * Primitivas del sistema de diseño (Fase 2), las mismas para la tienda y el
 * panel. Sin datos ni lógica de dominio: solo presentación con los tokens de
 * src/app/globals.css. Cada una tiene su sección en /admin/diseno.
 */
export { BUTTON_SIZES, BUTTON_VARIANTS, Button, buttonClass } from './Button';
export type { ButtonSize, ButtonVariant } from './Button';
export { Checkbox, Radio } from './Choice';
export { Eyebrow } from './Eyebrow';
export type { EyebrowTone } from './Eyebrow';
export { Field, Fieldset } from './Field';
export type { FieldControlProps } from './Field';
export { HEADING_SIZES, Heading } from './Heading';
export { ICON_NAMES, Icon } from './Icon';
export type { IconDirection, IconName, IconSize } from './Icon';
export { CONTROL_CLASSES, Input, SearchField, Select, Textarea } from './Input';
export type { InputType } from './Input';
export { StarDivider, StarList, StarLoader } from './StarMotifs';
export type { HeadingLevel, HeadingSize } from './Heading';
export { SubmitButton } from './SubmitButton';
export { TEXT_SIZES, TEXT_TONES, Text } from './Text';
export { TextLink } from './TextLink';
export type { TextSize, TextTone } from './Text';
