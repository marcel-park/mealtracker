package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.UserItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserItemRepository extends JpaRepository<UserItem, Long> {

    // The user's own user items whose name matches namePattern (a LIKE pattern in lower case
    // with '!' as escape character, see CatalogSearch.containsPattern), sorted by name.
    @Query("""
            select i from UserItem i
            where i.owner.id = :userId
              and lower(i.name) like :namePattern escape '!'
            order by lower(i.name), i.id
            """)
    List<UserItem> searchOwn(@Param("userId") Long userId,
                               @Param("namePattern") String namePattern,
                               Pageable pageable);

    // Whether the user already has an item of that name (any case), other than excludedId (null:
    // none excluded, for a new item).
    @Query("""
            select case when count(i) > 0 then true else false end from UserItem i
            where i.owner.id = :userId
              and lower(i.name) = lower(:name)
              and (:excludedId is null or i.id <> :excludedId)
            """)
    boolean existsNameOf(@Param("userId") Long userId,
                         @Param("name") String name,
                         @Param("excludedId") Long excludedId);
}
