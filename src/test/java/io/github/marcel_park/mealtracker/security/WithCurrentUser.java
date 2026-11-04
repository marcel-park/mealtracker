package io.github.marcel_park.mealtracker.security;

import org.springframework.security.test.context.support.WithSecurityContext;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

// For @WebMvcTest controller tests: runs the test as an authenticated CurrentUser without going
// through a real token. The token check itself is covered by SecurityConfigTest and the
// integration test.
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@WithSecurityContext(factory = WithCurrentUserSecurityContextFactory.class)
public @interface WithCurrentUser {

    long userId() default 1L;

    long tokenId() default 10L;

    boolean admin() default false;
}
