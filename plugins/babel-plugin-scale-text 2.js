/**
 * babel-plugin-scale-text
 *
 * Tự động thay thế `Text` import từ 'react-native' bằng `ScaledText`
 * trong tất cả các file thuộc thư mục app/.
 *
 * Ưu điểm so với Metro shim:
 * - Chỉ thay thế đúng named export `Text`, không spread toàn bộ module
 * - Không gây lỗi native module trong New Architecture
 * - Không cần folder shims
 *
 * Ví dụ transform:
 *   import { Text, View } from 'react-native'
 *   → import { View } from 'react-native'
 *   → import { ScaledText as Text } from '../../src/components/ScaledText'
 */

const path = require('path');

// Thư mục gốc của project (plugins/ nằm trong project root)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCALED_TEXT_ABS = path.resolve(PROJECT_ROOT, 'src/components/ScaledText');

module.exports = function ({ types: t }) {
  return {
    name: 'scale-text',
    visitor: {
      ImportDeclaration(nodePath, state) {
        const filename = state.filename || '';

        // Chỉ áp dụng cho files trong thư mục app/
        const isInApp =
          filename.includes('/app/') ||
          filename.includes(path.sep + 'app' + path.sep);
        if (!isInApp) return;

        // Chỉ xử lý import từ 'react-native'
        if (nodePath.node.source.value !== 'react-native') return;

        // Tìm specifier { Text } hoặc { Text as CustomName }
        const textSpecifier = nodePath.node.specifiers.find((s) => {
          if (!t.isImportSpecifier(s)) return false;
          const imported = t.isIdentifier(s.imported)
            ? s.imported.name
            : s.imported.value;
          return imported === 'Text';
        });

        if (!textSpecifier) return;

        // Tên local (vd: Text, hoặc T nếu import { Text as T })
        const localName = textSpecifier.local.name;

        // Xoá Text khỏi import gốc
        nodePath.node.specifiers = nodePath.node.specifiers.filter(
          (s) => s !== textSpecifier
        );

        // Tính đường dẫn tương đối từ file hiện tại đến ScaledText
        const fileDir = path.dirname(filename);
        let relativePath = path
          .relative(fileDir, SCALED_TEXT_ABS)
          .replace(/\\/g, '/');
        if (!relativePath.startsWith('.')) {
          relativePath = `./${relativePath}`;
        }

        // Tạo: import { ScaledText as <localName> } from '<relativePath>'
        const newImport = t.importDeclaration(
          [
            t.importSpecifier(
              t.identifier(localName),
              t.identifier('ScaledText')
            ),
          ],
          t.stringLiteral(relativePath)
        );

        // Chèn import mới ngay sau import gốc
        nodePath.insertAfter(newImport);

        // Nếu import gốc không còn specifier nào → xoá luôn
        if (nodePath.node.specifiers.length === 0) {
          nodePath.remove();
        }
      },
    },
  };
};
