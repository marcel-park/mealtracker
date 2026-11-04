package io.github.marcel_park.mealtracker.security;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithSecurityContextFactory;

public class WithCurrentUserSecurityContextFactory implements WithSecurityContextFactory<WithCurrentUser> {

    @Override
    public SecurityContext createSecurityContext(WithCurrentUser annotation) {
        CurrentUser user = new CurrentUser(annotation.userId(), annotation.tokenId(), annotation.admin());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(user, null, user.authorities()));
        return context;
    }
}
