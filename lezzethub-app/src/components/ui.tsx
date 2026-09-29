import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STATUS_META, initials } from '../lib/format';
import { colors, font, noOutline, radius, shadow, shadowSoft } from '../lib/theme';
import type { OrderStatus } from '../lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ------------------------------ Yerleşim ------------------------------ */

/** Koyu (ana renk) başlıklı ekranlarda durum çubuğu yazılarını açık renk yapar. */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  header,
  footer,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const inner = [padded && { paddingHorizontal: 16 }, { paddingBottom: 32 + (footer ? 0 : insets.bottom), paddingTop: 8 }, contentStyle];
  return (
    <View style={styles.screen}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.maxW}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

export function Header({
  title,
  subtitle,
  back = true,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {back ? (
        <IconButton
          name="chevron-back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Geri"
        />
      ) : (
        <View style={{ width: 4 }} />
      )}
      <View style={{ flex: 1, marginLeft: back ? 6 : 0 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={font.small} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

export function StickyFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.maxW}>{children}</View>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={font.h3}>{title}</Text>
      {!!action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.line, marginVertical: 12 }, style]} />;
}

/* ------------------------------ Kontroller ------------------------------ */

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: '#fff' },
    accent: { bg: colors.accent, fg: '#fff' },
    secondary: { bg: colors.primarySoft, fg: colors.primaryDark },
    ghost: { bg: 'transparent', fg: colors.primaryDark },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    success: { bg: colors.success, fg: '#fff' },
    outline: { bg: colors.card, fg: colors.inkSoft, border: colors.line },
  };
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 1 : 0 },
        (variant === 'primary' || variant === 'accent') && !off && shadowSoft,
        pressed && !off && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 19} color={p.fg} />}
          <Text style={[styles.btnText, small && { fontSize: 14 }, { color: p.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  badge,
  color = colors.ink,
  bg = colors.card,
  accessibilityLabel,
}: {
  name: IconName;
  onPress?: () => void;
  badge?: number;
  color?: string;
  bg?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} accessibilityRole="button" hitSlop={6} style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={name} size={21} color={color} />
      {!!badge && badge > 0 && (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  icon,
  right,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string; error?: string; icon?: IconName; right?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style as StyleProp<ViewStyle>]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrap, props.multiline && { alignItems: 'flex-start' }, focus && { borderColor: colors.primaryLight, backgroundColor: '#fff' }, !!error && { borderColor: colors.danger }]}>
        {icon && <Ionicons name={icon} size={18} color={focus ? colors.primary : colors.muted} style={{ marginRight: 8, marginTop: props.multiline ? 13 : 0 }} />}
        <TextInput
          placeholderTextColor={colors.muted}
          {...props}
          onFocus={(e) => {
            setFocus(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            props.onBlur?.(e);
          }}
          style={[styles.input, props.multiline && { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 }]}
        />
        {right}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  emoji,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  emoji?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}
    >
      {!!emoji && <Text style={{ fontSize: 14 }}>{emoji}</Text>}
      {icon && <Ionicons name={icon} size={14} color={active ? '#fff' : colors.primaryDark} />}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && { color: colors.primaryDark }]}>
              {o.label}
              {o.count !== undefined ? ` (${o.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ label, value, onChange, icon, description }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; description?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.toggle, value && { borderColor: colors.primaryLight, backgroundColor: colors.primarySoft }]} accessibilityRole="checkbox" accessibilityState={{ checked: value }}>
      {icon && <Ionicons name={icon} size={20} color={value ? colors.primary : colors.muted} />}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{label}</Text>
        {!!description && <Text style={font.small}>{description}</Text>}
      </View>
      <View style={[styles.check, value && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {value && <Ionicons name="checkmark" size={15} color="#fff" />}
      </View>
    </Pressable>
  );
}

/* ------------------------------ Gösterim ------------------------------ */

const TONES = {
  yellow: { bg: colors.warningBg, fg: colors.warning },
  blue: { bg: colors.infoBg, fg: colors.info },
  green: { bg: colors.successBg, fg: colors.success },
  red: { bg: colors.dangerBg, fg: colors.danger },
  gray: { bg: colors.neutralBg, fg: colors.neutral },
  orange: { bg: colors.accentSoft, fg: colors.accentDark },
  teal: { bg: colors.primarySoft, fg: colors.primaryDark },
  honey: { bg: colors.honeySoft, fg: colors.warning },
};
export type Tone = keyof typeof TONES;

export function Badge({ label, tone = 'orange', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon && <Ionicons name={icon} size={12} color={t.fg} />}
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  const icon: Record<OrderStatus, IconName> = {
    seller_pending: 'time-outline',
    approved: 'card-outline',
    paid: 'checkmark-circle-outline',
    completed: 'checkmark-done',
    rejected: 'close-circle-outline',
    cancelled: 'ban-outline',
  };
  return <Badge label={m.label} tone={m.tone} icon={icon[status]} />;
}

export function LocationBadge({ province, district, neighborhood, compact }: { province?: string; district: string; neighborhood: string; compact?: boolean }) {
  return (
    <View style={[styles.loc, compact && { paddingVertical: 2, paddingHorizontal: 0, backgroundColor: 'transparent' }]}>
      <Text style={{ fontSize: compact ? 11 : 12 }}>📍</Text>
      <Text style={[styles.locText, compact && { fontSize: 12 }]} numberOfLines={1}>
        {neighborhood}, {district}
        {province ? ` / ${province}` : ''}
      </Text>
    </View>
  );
}

export function Avatar({ uri, name, size = 44 }: { uri?: string; name: string; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.creamDeep }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontWeight: '800', color: colors.primaryDark, fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function EmptyState({ emoji = '🍽️', title, text, action, onAction }: { emoji?: string; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 34 }}>{emoji}</Text>
      </View>
      <Text style={[font.h3, { textAlign: 'center' }]}>{title}</Text>
      {!!text && <Text style={[font.body, { textAlign: 'center', marginTop: 6 }]}>{text}</Text>}
      {!!action && <Button title={action} onPress={onAction} style={{ marginTop: 16, alignSelf: 'center' }} small />}
    </View>
  );
}

export function StatCard({ label, value, icon, tone = 'orange', onPress }: { label: string; value: string | number; icon: IconName; tone?: Tone; onPress?: () => void }) {
  const t = TONES[tone];
  return (
    <Card style={styles.stat} onPress={onPress}>
      <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={18} color={t.fg} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={font.small} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value?: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={font.tiny}>{label}</Text>
        <Text style={{ color: colors.ink, fontSize: 15, marginTop: 1 }}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export function Notice({ tone = 'yellow', icon = 'information-circle', title, text }: { tone?: Tone; icon?: IconName; title?: string; text: string }) {
  const t = TONES[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]}>
      <Ionicons name={icon} size={20} color={t.fg} />
      <View style={{ flex: 1 }}>
        {!!title && <Text style={{ fontWeight: '800', color: t.fg, marginBottom: 2 }}>{title}</Text>}
        <Text style={{ color: t.fg, lineHeight: 19 }}>{text}</Text>
      </View>
    </View>
  );
}

export function Loading() {
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  maxW: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: colors.cream, gap: 8,
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: colors.ink },
  footer: {
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.pill, minHeight: 50,
  },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 14, minHeight: 38 },
  btnText: { fontSize: 16, fontWeight: '800' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', ...shadowSoft },
  dot: {
    position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.cream,
  },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginBottom: 6, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 12, minHeight: 46, ...noOutline },
  error: { color: colors.danger, fontSize: 12, marginTop: 4, marginLeft: 2 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4, marginLeft: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 13,
    borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '700', color: colors.inkSoft, fontSize: 13 },
  segment: { flexDirection: 'row', backgroundColor: colors.creamDeep, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card, ...shadowSoft },
  segmentText: { fontWeight: '700', color: colors.muted },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, marginBottom: 10,
  },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.creamDeep, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill, alignSelf: 'flex-start', maxWidth: '100%' },
  locText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, flexShrink: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stat: { flex: 1, padding: 14, minWidth: 140 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.ink },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, alignItems: 'flex-start' },
});
