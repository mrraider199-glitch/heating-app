import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pluralServices } from '../utils';
import styles from '../styles';

export function AnimatedIcon({ name, size = 28, color = '#fff', style }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 900, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return <Animated.View style={[{ transform: [{ scale }] }, style]}><Ionicons name={name} size={size} color={color} /></Animated.View>;
}

export function AnimatedCard({ children, index = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export function CategoryCard({ category, count, onPress, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay: index * 100, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(iconPulse, { toValue: 1.12, duration: 1600, useNativeDriver: true }),
      Animated.timing(iconPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim, iconPulse, index]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return (
    <Animated.View style={[styles.categoryCard, { backgroundColor: category.color + '18', borderColor: category.color + '55', opacity: anim, transform: [{ translateY }, { scale: press }] }]}>
      <TouchableOpacity style={styles.categoryCardInner} activeOpacity={1}
        onPressIn={() => Animated.spring(press, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        onPress={onPress}>
        <Animated.View style={{ transform: [{ scale: iconPulse }], alignSelf: 'flex-start' }}>
          <View style={[styles.categoryIconCircle, { backgroundColor: category.color }]}>
            <Ionicons name={category.icon} size={30} color="#fff" />
          </View>
        </Animated.View>
        <View style={{ flex: 1 }} />
        <Text style={styles.categoryCardTitle}>{category.title}</Text>
        <Text style={[styles.categoryCardCount, { color: category.color }]}>{count} {pluralServices(count)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function FadeInScreen({ children, duration = 400 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, [opacity, scale, duration]);
  return <Animated.View style={{ flex: 1, opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}