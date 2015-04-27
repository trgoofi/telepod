#include "forger.h"

#include <openssl/pem.h>
#include <openssl/err.h>

#include <node_buffer.h>


namespace telepod {


using namespace v8;


inline std::string GetOpensslErrorMessageWithPrefix(std::string prefix) {
  unsigned long ecode = ERR_get_error();
  if (ecode) {
    char emsg[128] = { 0 };
    ERR_error_string_n(ecode, emsg, sizeof(emsg));
    std::string errmsg(emsg);
    prefix = prefix + " " + errmsg;
  }
  return prefix;
}



Persistent<Function> Forger::constructor;


Forger::Forger(X509* ca_cert, EVP_PKEY* ca_key) : ca_cert_(ca_cert), ca_key_(ca_key) {

}


Forger::~Forger() {
  X509_free(ca_cert_);
  EVP_PKEY_free(ca_key_);
}


void Forger::Assemble(Handle<Object> exports) {
  Isolate* isolate = Isolate::GetCurrent();

  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, New);
  tpl->SetClassName(String::NewFromUtf8(isolate, "Forger"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(tpl, "forgeCert", ForgeCert);

  constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "Forger"), tpl->GetFunction());

  NODE_SET_METHOD(exports, "createForger", CreateForger);
}


void Forger::CreateForger(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);
  Forger::New(args);
}


static BIO* LoadBIOFromBuffer(const Handle<Value> buffer) {
  char* buffer_data = node::Buffer::Data(buffer);
  size_t buffer_lenght = node::Buffer::Length(buffer);
  BIO* bio = BIO_new(BIO_s_mem());
  BIO_write(bio, buffer_data, static_cast<int>(buffer_lenght));
  return bio;
}


void Forger::New(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (args.IsConstructCall()) {
    if (!(args[0]->IsObject())) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "options is required parameter")));
      return;
    };

    Local<Object> options = args[0]->ToObject();
    Local<Value> ca  = (*options)->Get(String::NewFromUtf8(isolate, "ca"));
    Local<Value> key = (*options)->Get(String::NewFromUtf8(isolate, "key"));

    if (!node::Buffer::HasInstance(ca)) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "ca require a buffer")));
      return;
    }
    if (!node::Buffer::HasInstance(key)) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "key require a buffer")));
      return;
    }

    X509* ca_x;
    BIO* ca_bio = LoadBIOFromBuffer(ca);
    if (!(ca_x = PEM_read_bio_X509_AUX(ca_bio, nullptr, nullptr, nullptr))) {
      std::string errmsg = GetOpensslErrorMessageWithPrefix("Error reading ca!");
      isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, errmsg.c_str())));
      return;
    }
    BIO_free_all(ca_bio);

    EVP_PKEY* ca_key;
    BIO* key_bio = LoadBIOFromBuffer(key);
    if (!(ca_key = PEM_read_bio_PrivateKey(key_bio, nullptr, nullptr, nullptr))) {
      std::string errmsg = GetOpensslErrorMessageWithPrefix("Error reading key!");
      isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, errmsg.c_str())));
      return;
    }
    BIO_free_all(key_bio);

    Forger* forger = new Forger(ca_x, ca_key);
    forger->Wrap(args.This());
    args.GetReturnValue().Set(args.This());
  } else {
    const int argc = 1;
    Local<Value> argv[argc] = { args[0] };
    Local<Function> cons = Local<Function>::New(isolate, constructor);
    args.GetReturnValue().Set(cons->NewInstance(argc, argv));
  }
}


void Forger::ForgeCert(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (args.Length() < 2) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "hostname and callback expected")));
    return;
  }
  if (!(args[0]->IsString())) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "hostname must be string for the 1st arguments")));
    return;
  }
  if (!(args[1]->IsFunction())) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "callback must be function for the 2nd arguments")));
    return;
  }

  String::Utf8Value hostname(args[0]->ToString());
  Forger* forger = ObjectWrap::Unwrap<Forger>(args.Holder());

  Local<Value> error;
  Local<Value> cert;

  X509Forgery forgery(*forger, *hostname);
  const char* x509 = forgery.x509();
  if (!x509) {
    error = Exception::Error(String::NewFromUtf8(isolate, forgery.errmsg().c_str()));
    cert = Undefined (isolate);
  } else {
    error = Undefined (isolate);
    cert = node::Buffer::New(isolate, x509, forgery.x509_length());
  }

  const int argc = 2;
  Local<Value> argv[argc] = { error, cert };
  Local<Function> callback = Local<Function>::Cast(args[1]);
  callback->Call(isolate->GetCurrentContext()->Global(), argc, argv);
}





X509Forgery::X509Forgery(const Forger& forger, const char* hostname) : forger_(forger), hostname_(hostname) {

}


X509Forgery::~X509Forgery() {
  FastFreeX();
  delete[] cert_c_;
}


void X509Forgery::FastFreeX() {
  X509_free(cert_x_);
  cert_x_ = nullptr;
  BIO_free_all(cert_bio_);
  cert_bio_ = nullptr;
}


bool X509Forgery::CreateX509() {
  if (!(cert_x_ = X509_new())) {
    return false;
  }
  if (!X509_set_version(cert_x_, 2L)) {
    return false;
  }
  if (!ASN1_INTEGER_set(X509_get_serialNumber(cert_x_), forger_.NextSerialNumber())) {
    return false;
  }
  if (!X509_gmtime_adj(X509_get_notBefore(cert_x_), 0L)) {
    return false;
  }
  if (!X509_gmtime_adj(X509_get_notAfter(cert_x_), forger_.valid_days_)) {
    return false;
  }
  if (!X509_set_pubkey(cert_x_, forger_.ca_key_)) {
    return false;
  }

  const int kRow = 6;
  const int kColumn = 2;
  std::string entrys[kRow][kColumn] = {
    {"C",  "CN"},
    {"ST", "Solar System"},
    {"L",  "Earth"},
    {"O",  "Telepod Electron Empire"},
    {"OU", "Telepod Electron Unit"},
    {"CN", hostname_}
  };
  X509_NAME* name = X509_get_subject_name(cert_x_);
  for (int i = 0; i < kRow; ++i) {
    const char* field = entrys[i][0].c_str();
    const unsigned char* value = reinterpret_cast<const unsigned char*>(entrys[i][1].c_str());
    if (!X509_NAME_add_entry_by_txt(name, field, MBSTRING_ASC, value, -1, -1, 0)) {
      return false;
    }
  }

  X509_NAME* ca_name = X509_get_subject_name(forger_.ca_cert_);
  if (!X509_set_issuer_name(cert_x_, ca_name)) {
    return false;
  }
  if (!X509_sign(cert_x_, forger_.ca_key_, EVP_sha256())) {
    return false;
  }

  if (!(cert_bio_ = BIO_new(BIO_s_mem()))) {
    return false;
  }

  if (!PEM_write_bio_X509(cert_bio_, cert_x_)) {
    return false;
  }

  BUF_MEM* bmptr;
  BIO_get_mem_ptr(cert_bio_, &bmptr);
  cert_c_length_ = bmptr->length;
  cert_c_ = new char[cert_c_length_ + 1];
  if (!BIO_read(cert_bio_, cert_c_, static_cast<int>(cert_c_length_))) {
    return false;
  };

  return true;
}


const char* X509Forgery::x509() {
  if (!cert_c_) {
    if (!CreateX509()) {
      std::string prefiex = "Error forging: ";
      prefiex += hostname_;
      errmsg_ = GetOpensslErrorMessageWithPrefix(prefiex);

      delete[] cert_c_;
      cert_c_ = nullptr;
    }
    FastFreeX();
  }
  return cert_c_;
}


} // namespace telepod
