import React from 'react';
import { Pressable, View } from 'react-native';
import type { ExecutionStep, ExecutionStepId } from '../staff-execution-flow-models';
import { colors, Label, StaffIcon } from './staff-ui';

const stateLabel = { done: 'Đã xong', current: 'Đang làm', upcoming: 'Chưa làm', skipped: 'Đã bỏ qua' } as const;

export function StaffExecutionProgress({
  steps,
  onSelect,
}: {
  steps: ExecutionStep[];
  onSelect?: (step: ExecutionStepId) => void;
}) {
  return <View accessibilityRole="list" accessibilityLabel="Tiến độ xử lý sự vụ" style={{ gap: 0 }}>
    {steps.map((step, index) => {
      const done = step.state === 'done';
      const current = step.state === 'current';
      const skipped = step.state === 'skipped';
      const enabled = Boolean(onSelect && step.state !== 'upcoming');
      const tone = done ? colors.emeraldDark : current ? colors.primary : colors.muted;
      return <Pressable
        key={step.id}
        accessibilityRole={enabled ? 'button' : undefined}
        accessibilityLabel={`${step.label}. ${stateLabel[step.state]}`}
        accessibilityState={{ selected: current, disabled: !enabled }}
        disabled={!enabled}
        onPress={() => onSelect?.(step.id)}
        style={{ minHeight: 72, flexDirection: 'row', gap: 12 }}
      >
        <View style={{ width: 30, alignItems: 'center' }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: current ? 2 : 1, borderColor: tone, backgroundColor: done ? colors.emeraldLight : current ? colors.primarySoft : colors.surface }}>
            {done ? <StaffIcon name="check" size={16} color={colors.emeraldDark} /> : <Label bold size={12} style={{ color: tone }}>{index + 1}</Label>}
          </View>
          {index < steps.length - 1 && <View style={{ width: 1, flex: 1, minHeight: 36, backgroundColor: done ? colors.emeraldDark : colors.border }} />}
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingBottom: 16, gap: 3 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Label bold size={14} style={{ color: current ? colors.primaryDark : colors.text }}>{step.label}</Label>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: done ? colors.emeraldLight : current ? colors.primarySoft : colors.borderLight }}>
              <Label bold size={11} style={{ color: skipped ? colors.muted : tone }}>{stateLabel[step.state]}</Label>
            </View>
          </View>
          <Label muted size={12}>{step.description}</Label>
        </View>
      </Pressable>;
    })}
  </View>;
}
