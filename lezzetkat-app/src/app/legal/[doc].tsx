import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Card, EmptyState, Header, Screen } from '../../components/ui';
import { LEGAL_DOCS } from '../../lib/legal';
import { colors, font } from '../../lib/theme';

/** /legal/privacy ve /legal/terms: web sürümünde mağaza başvurusu için herkese açık adres olarak da kullanılır. */
export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL_DOCS[doc as keyof typeof LEGAL_DOCS];

  if (!content) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="Belge" />
        <EmptyState emoji="📄" title="Belge bulunamadı" />
      </View>
    );
  }

  return (
    <Screen header={<Header title={content.title} subtitle={`Son güncelleme: ${content.updated}`} />}>
      <Card>
        {content.sections.map((s) => (
          <View key={s.heading} style={{ marginBottom: 16 }}>
            <Text style={[font.h3, { marginBottom: 6 }]}>{s.heading}</Text>
            <Text style={[font.body, { color: colors.inkSoft }]}>{s.body}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
