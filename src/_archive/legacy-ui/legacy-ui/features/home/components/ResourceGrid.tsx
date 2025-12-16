import { ResourceDatum } from '@/demo/demoData';
import { ResourceCard } from '@/ui/components/ResourceCard';
import { SectionHeader } from '@/ui/components/SectionHeader';
import { spacing } from '@/ui/theme';
import { FlatList, StyleSheet, View } from 'react-native';

export type ResourceGridProps = {
  resources: ResourceDatum[];
};

export const ResourceGrid = ({ resources }: ResourceGridProps) => {
  return (
    <View style={styles.container}>
      <SectionHeader title="Resources" actionLabel="See all" onActionPress={() => {}} />
      <FlatList
        data={resources}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
        renderItem={({ item }) => <ResourceCard {...item} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md
  }
});
