import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

with open("public.pem", "r") as f:
    public_key = f.read()


def verify_token(token):
    try:
        payload = jwt.decode(token, public_key, algorithms=["RS256"])
        print("✅ Authenticated:", payload["sub"])
        return payload
    except ExpiredSignatureError:
        print("❌ Token expired")
    except InvalidTokenError:
        print("❌ Invalid token")
