import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()

class BearerJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth or auth[0].lower() != b"bearer":
            return None
        if len(auth) != 2:
            raise AuthenticationFailed("Invalid Authorization header.")

        token = auth[1].decode("utf-8")
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        except Exception as e:
            raise AuthenticationFailed(f"Invalid token: {e}")

        user_id = payload.get("user_id") or payload.get("id") or payload.get("sub")
        if not user_id:
            raise AuthenticationFailed("No user id in token.")

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed("User does not exist.")

        return (user, None)