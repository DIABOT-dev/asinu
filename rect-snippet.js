 _objectSpread({
      vectorEffect: "non-scaling-stroke",
      id: (_evaluateProp = (0, _helpers.evaluateProp)(id, props)) === null || _evaluateProp === void 0 ? void 0 : _evaluateProp.toString(),
      tabIndex: (0, _helpers.evaluateProp)(tabIndex, props)
    }, rest);
    return desc ? /*#__PURE__*/_react.default.createElement("rect", _extends({}, svgProps, {
      ref: ref
    }), /*#__PURE__*/_react.default.createElement("desc", null, desc)) : /*#__PURE__*/_react.default.createElement("rect", _extends({}, svgProps, {
      ref: ref
    }));
  });
  exports.Rect = Rect;
},1494,[66,1478],"node_modules/victory-core/lib/victory-primitives/rect.js");
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Text = void 0;
  var _react = _interopRequireDefault(require(_dependencyMap[0], "react"));
  var _helpers = require(_dependencyMap[1], "../victory-util/helpers");
  var _excluded = ["children", "desc", "id", "origin", "tabIndex", "title"];
  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }
  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      enumerableOnly && (symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      })), keys.push.apply(keys, symbols);
    }
    return keys;
  }
  function _objectSpread(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = null != arguments[i] ? arguments[i] : {};
      i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
    return target;
  }
  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _objectWithoutProperties(source, excluded) {
    if (source == null) return {};
    var target = _objectWithoutPropertiesLoose(source, excluded);
    var key, i;
    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceS