#include "cache.h"


namespace telepod {


using namespace v8;


Persistent<Function> CacheWrap::constructor;


void CacheWrap::Assemble(Handle<Object> exports) {
  Isolate* isolate = Isolate::GetCurrent();

  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "LRUCache"));
  tpl->InstanceTemplate()->SetInternalFieldCount(2);

  NODE_SET_PROTOTYPE_METHOD(tpl, "get", Get);
  NODE_SET_PROTOTYPE_METHOD(tpl, "set", Set);

  constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "LRUCache"), tpl->GetFunction());

  NODE_SET_METHOD(exports, "createLRUCache", CreateLRUCache);
}


void CacheWrap::CreateLRUCache(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);
  CacheWrap::New(args);
}


void Dispose(const std::string& key, MoveableUniquePersistent<Value>& value) {
  value.Reset();
}


CacheWrap::CacheWrap(size_t capacity, double evict_factor) {
  cache_ = new LRUCache< std::string, MoveableUniquePersistent<Value> >(capacity, Dispose, evict_factor);
}


void CacheWrap::New(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (args.IsConstructCall()) {
    size_t capacity;
    double evict_factor = 0.3;
    if (args.Length() < 1) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "capacity is required.")));
      return;
    }
    if (!args[0]->IsNumber()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "capacity expected a number.")));
      return;
    }
    if (args.Length() > 1) {
      if (!args[1]->IsNumber()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "evictFactor expected a number.")));
        return;
      }
      evict_factor = args[1]->NumberValue();
      if (evict_factor >= 1 || evict_factor <= 0) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "evictFactor must be in (0, 1).")));
        return;
      }
    }
    capacity = args[0]->Uint32Value();

    CacheWrap* cacheWrap = new CacheWrap(capacity, evict_factor);
    cacheWrap->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    args.GetReturnValue().Set(cons->NewInstance(argc, argv));
  }

}


std::string GetStringValue(Handle<Value> value) {
  String::Utf8Value tmp(value);
  return std::string(*tmp);
}


void CacheWrap::Get(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (args.Length() != 1) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "key is expected.")));
    return;
  }

  std::string key = GetStringValue(args[0]);
  CacheWrap* cacheWrap = ObjectWrap::Unwrap<CacheWrap>(args.Holder());
  const MoveableUniquePersistent<Value>* tmp = cacheWrap->cache_->Get(key);
  if (tmp != nullptr) {
    args.GetReturnValue().Set(Local<Value>::New(isolate, *tmp));
  } else {
    args.GetReturnValue().Set(Undefined(isolate));
  }
}


void CacheWrap::Set(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (args.Length() < 2) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "key and value are expected.")));
  }

  std::string key = GetStringValue(args[0]);
  MoveableUniquePersistent<Value> value(isolate, args[1]);

  CacheWrap* cacheWrap = ObjectWrap::Unwrap<CacheWrap>(args.Holder());
  cacheWrap->cache_->Set(std::move(key), std::move(value));
}


} // namespace telepod
