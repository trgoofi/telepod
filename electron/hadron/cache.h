#ifndef TELEPOD_CACHE_H
#define TELEPOD_CACHE_H

#include <iostream>
#include <list>
#include <unordered_map>
#include <functional>
#include <algorithm>

#include <node.h>
#include <node_object_wrap.h>


namespace telepod {


template <typename K, typename V>
class Cache {
 public:
  explicit Cache(size_t capacity = 10) : capacity_(capacity) { }
  virtual ~Cache() { }

  virtual V* Get(const K& key) = 0;
  virtual void Set(K&& key, V&& value) = 0;
  virtual size_t Size() = 0;

 protected:
  size_t capacity_;
};





template <typename K, typename V>
class LRUCache : public Cache<K, V> {
public:
  typedef std::function<void (const K&, V&)> DisposeCallback;

  LRUCache(size_t capacity, DisposeCallback dispose_callback = nullptr, double evict_factor = 0.3)
      : Cache<K, V>(capacity),
        evict_num_(capacity * evict_factor),
        dispose_callback_(dispose_callback) {

  };

  ~LRUCache();

  V* Get(const K& key);
  void Set(K&& key, V&& value);
  size_t Size() { return cache_.size(); }
  void Evict();

private:
  struct Entry;

  typedef typename std::list<K>::iterator KeyIter;
  typedef typename std::unordered_map<K, Entry>::iterator ValueIter;

  struct Entry {
    Entry(V&& value, const KeyIter iter) : value_(std::move(value)), iter_(iter), hits_(0) { };
    Entry(const Entry&) = delete;
    Entry(Entry&& that) : value_(std::move(that.value_)), iter_(that.iter_), hits_(that.hits_) { };

    Entry& operator=(Entry&& that) {
      if (this != &that) {
        value_ = std::move(that.value_);
        iter_  = that.iter_;
        hits_  = that.hits_;
      }
      return *this;
    };

    inline V& operator*() { return value_ ; }


    V value_;
    KeyIter iter_;
    unsigned int hits_;

  };

  size_t evict_num_;
  DisposeCallback dispose_callback_;
  std::list<K> keys_;
  std::unordered_map<K, Entry> cache_;
};


template <typename K, typename V>
LRUCache<K, V>::~LRUCache() {
  if (dispose_callback_ != nullptr) {
    for (ValueIter iter = cache_.begin(); iter != cache_.end(); ++iter) {
      dispose_callback_(std::get<0>(*iter), std::get<1>(*iter).value_);
    }
  }
};


template <typename K, typename V>
V* LRUCache<K, V>::Get(const K& key) {
  ValueIter iter = cache_.find(key);
  if (iter != cache_.end()) {
    Entry& entry = std::get<1>(*iter);
    ++entry.hits_;
    keys_.splice(keys_.end(), keys_, entry.iter_);
    return &(*entry);
  }
  return nullptr;
};


template <typename K, typename V>
void LRUCache<K, V>::Set(K&& key, V&& value) {
  if (cache_.size() == this->capacity_) {
    Evict();
  }

  ValueIter iter = cache_.find(key);
  if (iter == cache_.end()) {
    KeyIter key_iter = keys_.insert(keys_.end(), key);
    cache_.insert(std::make_pair(std::move(key), Entry(std::move(value), key_iter)));
  } else {
    Entry& entry = std::get<1>(*iter);
    if (dispose_callback_) {
      dispose_callback_(std::get<0>(*iter), *entry);
    }
    *entry = std::move(value);
  }
};


template <typename K, typename V>
void LRUCache<K, V>::Evict() {
  size_t evict_num = std::min(cache_.size(), evict_num_);
  for (size_t i = 0; i < evict_num; ++i) {
    K& key = keys_.front();
    ValueIter iter = cache_.find(key);
    if (dispose_callback_ != nullptr) {
      dispose_callback_(key, std::get<1>(*iter).value_);
    }
    cache_.erase(iter);
    keys_.pop_front();
  }
};





template <typename T>
class MoveableUniquePersistent : public v8::UniquePersistent<T> {
 public:
  MoveableUniquePersistent() : v8::UniquePersistent<T>() { }

  template<typename S>
  MoveableUniquePersistent(v8::Isolate* isolate, v8::Handle<S> that)
      : v8::UniquePersistent<T>(isolate, that) { }

  template<typename S>
  MoveableUniquePersistent(v8::Isolate* isolate, const v8::PersistentBase<S>& that)
      : v8::UniquePersistent<T>(isolate, that) { }

  MoveableUniquePersistent(MoveableUniquePersistent&& that)
      : v8::UniquePersistent<T>(that.Pass()) { }

  MoveableUniquePersistent& operator=(MoveableUniquePersistent&& that) {
    if (this != &that) {
      v8::UniquePersistent<T>::operator=(that.Pass());
    }
    return *this;
  }
};





class CacheWrap : public node::ObjectWrap {
 public:
  static void Assemble(v8::Handle<v8::Object> exports);

 private:
  CacheWrap(size_t capacity, double evict_factor);
  ~CacheWrap() { delete cache_; };

  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void CreateLRUCache(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Get(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Set(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;

  Cache< std::string, MoveableUniquePersistent<v8::Value> >* cache_;
};


} // namespace telepod


#endif
