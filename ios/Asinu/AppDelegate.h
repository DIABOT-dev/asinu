#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <Expo/Expo.h>

@class RCTReactNativeFactory;
@class ReactNativeDelegate;

@interface AppDelegate : EXAppDelegateWrapper

@property (nonatomic, strong) UIWindow *window;
@property (nonatomic, strong) RCTReactNativeFactory *reactNativeFactory;
@property (nonatomic, strong) ReactNativeDelegate *reactNativeDelegate;

@end
