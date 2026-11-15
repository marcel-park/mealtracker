package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.UserItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

import static io.github.marcel_park.mealtracker.repository.NamePatterns.at;

public interface UserItemRepository extends JpaRepository<UserItem, Long> {

    // The user's own user items whose name matches every pattern (see FoodRepository.search and
    // CatalogSearch.namePatterns; empty: all of them), sorted by name.
    default List<UserItem> searchOwn(Long userId, List<String> namePatterns, Pageable pageable) {
        return searchOwnByPatterns(userId, at(namePatterns, 0), at(namePatterns, 1), at(namePatterns, 2), at(namePatterns, 3),
                at(namePatterns, 4),
                pageable);
    }

    // p1 to p5: the patterns, see NamePatterns.
    @Query("""
            select i from UserItem i
            where i.owner.id = :userId
              and (:p1 is null or lower(i.name) like :p1 escape '!')
              and (:p2 is null or lower(i.name) like :p2 escape '!')
              and (:p3 is null or lower(i.name) like :p3 escape '!')
              and (:p4 is null or lower(i.name) like :p4 escape '!')
              and (:p5 is null or lower(i.name) like :p5 escape '!')
            order by lower(i.name), i.id
            """)
    List<UserItem> searchOwnByPatterns(@Param("userId") Long userId,
                             @Param("p1") String p1, @Param("p2") String p2, @Param("p3") String p3,
                             @Param("p4") String p4, @Param("p5") String p5,
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
