#ifndef TELEPOD_FORGER_H
#define TELEPOD_FORGER_H

#include <iostream>

#include <openssl/x509.h>

#include <node.h>
#include <node_object_wrap.h>


namespace telepod {


class X509Forgery;

class Forger : public node::ObjectWrap {
 friend class X509Forgery;

 public:
  static void Assemble(v8::Handle<v8::Object> exports);

 private:
  Forger(X509* ca_cert, EVP_PKEY* ca_key);
  ~Forger();
  Forger(const Forger&);
  Forger& operator=(const Forger&);

  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void CreateForger(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void ForgeCert(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;

  long NextSerialNumber() const;

  X509* ca_cert_;
  EVP_PKEY* ca_key_;
  long valid_days_ = 3650 * (60 * 60 * 24);

};


class X509Forgery {
 public:
  X509Forgery(const Forger& forger, const char* hostname);
  ~X509Forgery();

  const char* x509();
  size_t x509_length() const { return cert_c_length_; }
  std::string errmsg() const { return errmsg_; }

 private:
  X509Forgery(const X509Forgery&);
  X509Forgery& operator=(const X509Forgery&);

  void FastFreeX();
  bool CreateX509();

  const Forger& forger_;
  const char* hostname_;

  char* cert_c_ = nullptr;
  size_t cert_c_length_ = 0;
  std::string errmsg_;

  X509* cert_x_ = nullptr;
  BIO* cert_bio_ = nullptr;

};


} // namespace telepod


#endif
