#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface LedgerBackup : NSObject <RCTBridgeModule>
@end

@implementation LedgerBackup

RCT_EXPORT_MODULE(LedgerBackup)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSURL *)backupDirectory
{
  return [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:@"MyBudgetBackups"]
                   isDirectory:YES];
}

RCT_EXPORT_METHOD(writeBackup:(NSString *)json
                  filename:(NSString *)filename
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![filename hasPrefix:@"my-budget-backup-"] || ![filename.pathExtension isEqualToString:@"json"] ||
      ![filename.lastPathComponent isEqualToString:filename]) {
    reject(@"INVALID_FILENAME", @"백업 파일 이름을 확인해 주세요.", nil);
    return;
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  NSError *error = nil;
  id document = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:&error] : nil;
  if (![document isKindOfClass:NSDictionary.class]) {
    reject(@"INVALID_JSON", @"백업 JSON 형식을 확인해 주세요.", nil);
    return;
  }
  NSFileManager *files = NSFileManager.defaultManager;
  NSURL *folder = [[self backupDirectory] URLByAppendingPathComponent:NSUUID.UUID.UUIDString isDirectory:YES];
  if (![files createDirectoryAtURL:folder withIntermediateDirectories:YES attributes:nil error:&error]) {
    reject(@"WRITE_FAILED", @"백업 파일을 만들지 못했습니다.", nil);
    return;
  }
  NSURL *url = [folder URLByAppendingPathComponent:filename];
  // 각 백업은 별도 임시 폴더에 원자적으로 기록하며 로컬 가계부 파일에는 접근하지 않습니다.
  if (![data writeToURL:url options:(NSDataWritingAtomic | NSDataWritingFileProtectionCompleteUntilFirstUserAuthentication)
                 error:&error]) {
    [files removeItemAtURL:folder error:nil];
    reject(@"WRITE_FAILED", @"백업 파일을 저장하지 못했습니다.", nil);
    return;
  }
  resolve(url.absoluteString);
}

RCT_EXPORT_METHOD(removeBackup:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:value];
  NSURL *folder = url.URLByDeletingLastPathComponent.URLByStandardizingPath;
  NSURL *parent = folder.URLByDeletingLastPathComponent;
  if (!url.isFileURL || ![parent.path isEqualToString:[self backupDirectory].URLByStandardizingPath.path] ||
      ![[NSUUID alloc] initWithUUIDString:folder.lastPathComponent]) {
    reject(@"INVALID_FILE", @"정리할 백업 파일을 확인해 주세요.", nil);
    return;
  }
  NSError *error = nil;
  if (![NSFileManager.defaultManager removeItemAtURL:folder error:&error]) {
    reject(@"CLEANUP_FAILED", @"임시 백업 파일을 정리하지 못했습니다.", nil);
    return;
  }
  resolve(nil);
}

@end
