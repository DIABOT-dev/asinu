module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Tự động thay Text → ScaledText trong tất cả files thuộc app/
      // reanimated/plugin phải ở CUỐI danh sách
      require('./plugins/babel-plugin-scale-text'),
      'react-native-reanimated/plugin',
    ],
  };
};
